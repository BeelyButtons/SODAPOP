import { createWorker, OEM, PSM, type LoggerMessage } from 'tesseract.js'
import type { OcrBox, OcrWord } from '../domain/reviewSchema'

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

type TesseractWord = {
  text: string
  confidence: number
  bbox: OcrBox
  font_name?: string
}

type TesseractBlock = {
  paragraphs?: Array<{
    lines?: Array<{
      words?: TesseractWord[]
    }>
  }>
}

function flattenWords(blocks: unknown): OcrWord[] {
  if (!Array.isArray(blocks)) return []

  return (blocks as TesseractBlock[]).flatMap((block) =>
    (block.paragraphs ?? []).flatMap((paragraph) =>
      (paragraph.lines ?? []).flatMap((line) =>
        (line.words ?? []).map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
          fontName: word.font_name,
        })),
      ),
    ),
  )
}

function measureInkRatio(canvas: HTMLCanvasElement, box: OcrBox) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return undefined
  const x0 = Math.max(0, Math.floor(box.x0))
  const y0 = Math.max(0, Math.floor(box.y0))
  const x1 = Math.min(canvas.width, Math.ceil(box.x1))
  const y1 = Math.min(canvas.height, Math.ceil(box.y1))
  if (x1 <= x0 || y1 <= y0) return undefined

  const pixels = context.getImageData(x0, y0, x1 - x0, y1 - y0).data
  const luminances: number[] = []
  for (let index = 0; index < pixels.length; index += 4) luminances.push(pixels[index])
  const sorted = [...luminances].sort((left, right) => left - right)
  const background = sorted[Math.floor(sorted.length / 2)] ?? 255
  const foregroundPixels = luminances.filter((value) => Math.abs(value - background) >= 38).length
  return foregroundPixels / Math.max(1, luminances.length)
}

async function preprocessImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const sourceWidth = bitmap.width
    const sourceHeight = bitmap.height
    const longestSide = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, 2200 / longestSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      bitmap.close()
      return { image: file, width: sourceWidth, height: sourceHeight }
    }

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
    return { image: canvas, width: canvas.width, height: canvas.height }
  } catch {
    return { image: file, width: 0, height: 0 }
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
    const prepared = await preprocessImage(file)
    const result = await withTimeout(
      worker.recognize(prepared.image, {}, { text: true, blocks: true }),
      30_000,
      'The label review exceeded 30 seconds. Try a smaller or clearer image.',
    )
    const words = flattenWords(result.data.blocks).map((word) => ({
      ...word,
      inkRatio:
        prepared.image instanceof HTMLCanvasElement
          ? measureInkRatio(prepared.image, word.bbox)
          : undefined,
    }))
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      durationMs: performance.now() - startedAt,
      words,
      imageWidth: prepared.width,
      imageHeight: prepared.height,
    }
  } catch (error) {
    await discardWorker()
    throw error
  } finally {
    progressListener = null
  }
}
