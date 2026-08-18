import { createWorker, OEM, PSM, type LoggerMessage } from 'tesseract.js'

export type OcrProgress = {
  progress: number
  message: string
}

let workerPromise: ReturnType<typeof createWorker> | null = null
let progressListener: ((progress: OcrProgress) => void) | null = null

function baseAssetPath(path: string) {
  return `${import.meta.env.BASE_URL}${path}`.replace(/\/+/g, '/')
}

function reportProgress(message: LoggerMessage) {
  progressListener?.({
    progress: Math.round(message.progress * 100),
    message: message.status.replace(/_/g, ' '),
  })
}

function withTimeout<Value>(promise: Promise<Value>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

async function discardWorker() {
  const pendingWorker = workerPromise
  workerPromise = null
  if (!pendingWorker) return
  try {
    const worker = await pendingWorker
    await worker.terminate()
  } catch {
    // A failed worker has nothing left to release.
  }
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: baseAssetPath('ocr/worker.min.js'),
      langPath: baseAssetPath('ocr/tessdata'),
      corePath: baseAssetPath('ocr/core'),
      logger: reportProgress,
    })
      .then(async (worker) => {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          preserve_interword_spaces: '1',
        })
        return worker
      })
      .catch((error: unknown) => {
        workerPromise = null
        throw error
      })
  }
  return workerPromise
}

async function preprocessImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const longestSide = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, 2200 / longestSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return file

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < image.data.length; index += 4) {
      const grey =
        image.data[index] * 0.299 +
        image.data[index + 1] * 0.587 +
        image.data[index + 2] * 0.114
      const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.18 + 128))
      image.data[index] = contrasted
      image.data[index + 1] = contrasted
      image.data[index + 2] = contrasted
    }
    context.putImageData(image, 0, 0)
    return canvas
  } catch {
    return file
  }
}

export async function recognizeLabel(
  file: File,
  onProgress: (progress: OcrProgress) => void,
) {
  const startedAt = performance.now()
  progressListener = onProgress
  onProgress({ progress: 3, message: 'Preparing image' })

  try {
    const worker = await withTimeout(
      getWorker(),
      20_000,
      'The local OCR engine took too long to initialize. Please try again.',
    )
    const image = await preprocessImage(file)
    const result = await withTimeout(
      worker.recognize(image, {}, { text: true, blocks: false }),
      30_000,
      'The label review exceeded 30 seconds. Try a smaller or clearer image.',
    )
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      durationMs: performance.now() - startedAt,
    }
  } catch (error) {
    await discardWorker()
    throw error
  } finally {
    progressListener = null
  }
}
