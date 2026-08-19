import { createWorker, OEM, PSM, type LoggerMessage } from 'tesseract.js'
import {
  bestObservedLine,
  collapseWhitespace,
  findAlcohol,
  findVolume,
  parseAlcohol,
  parseVolume,
  similarity,
} from '../domain/normalization'
import { GOVERNMENT_WARNING, type ApplicationData, type OcrBox, type OcrWord } from '../domain/reviewSchema'

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

type TesseractLine = {
  words?: TesseractWord[]
}

type TesseractBlock = {
  paragraphs?: Array<{ lines?: TesseractLine[] }>
}

function inverseRotatedBox(
  box: OcrBox,
  angle: number,
  width: number,
  height: number,
  rotatedWidth: number,
  rotatedHeight: number,
): OcrBox {
  if (Math.abs(angle) < 0.001) return box
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const points = [
    { x: box.x0, y: box.y0 },
    { x: box.x1, y: box.y0 },
    { x: box.x1, y: box.y1 },
    { x: box.x0, y: box.y1 },
  ].map((point) => {
    const x = point.x - rotatedWidth / 2
    const y = point.y - rotatedHeight / 2
    return {
      x: x * cosine + y * sine + width / 2,
      y: -x * sine + y * cosine + height / 2,
    }
  })
  return {
    x0: Math.min(...points.map((point) => point.x)),
    y0: Math.min(...points.map((point) => point.y)),
    x1: Math.max(...points.map((point) => point.x)),
    y1: Math.max(...points.map((point) => point.y)),
    points,
  }
}

function flattenWords(
  blocks: unknown,
  rotationRadians: number,
  imageWidth: number,
  imageHeight: number,
  rotatedWidth: number,
  rotatedHeight: number,
): OcrWord[] {
  if (!Array.isArray(blocks)) return []

  return (blocks as TesseractBlock[]).flatMap((block, blockIndex) =>
    (block.paragraphs ?? []).flatMap((paragraph, paragraphIndex) =>
      (paragraph.lines ?? []).flatMap((line, lineIndex) =>
        (line.words ?? []).map((word) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: inverseRotatedBox(
            word.bbox,
            rotationRadians,
            imageWidth,
            imageHeight,
            rotatedWidth,
            rotatedHeight,
          ),
          lineId: `${blockIndex}-${paragraphIndex}-${lineIndex}`,
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

function stretchGreyscale(image: ImageData) {
  const histogram = new Uint32Array(256)
  for (let index = 0; index < image.data.length; index += 4) {
    const grey = Math.round(
      image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114,
    )
    histogram[grey] += 1
  }
  const pixelCount = image.data.length / 4
  function percentile(fraction: number) {
    const target = pixelCount * fraction
    let cumulative = 0
    for (let value = 0; value < histogram.length; value += 1) {
      cumulative += histogram[value]
      if (cumulative >= target) return value
    }
    return 255
  }
  const low = percentile(0.03)
  const high = percentile(0.97)
  const range = Math.max(20, high - low)
  for (let dataIndex = 0; dataIndex < image.data.length; dataIndex += 4) {
    const value =
      image.data[dataIndex] * 0.299 +
      image.data[dataIndex + 1] * 0.587 +
      image.data[dataIndex + 2] * 0.114
    const adjusted = Math.max(0, Math.min(255, ((value - low) / range) * 255))
    image.data[dataIndex] = adjusted
    image.data[dataIndex + 1] = adjusted
    image.data[dataIndex + 2] = adjusted
  }
}

function adaptiveThreshold(source: HTMLCanvasElement) {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const sourceContext = source.getContext('2d', { willReadFrequently: true })
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!sourceContext || !context) return source
  const image = sourceContext.getImageData(0, 0, source.width, source.height)
  const width = source.width
  const height = source.height
  const stride = width + 1
  const integral = new Float64Array((width + 1) * (height + 1))
  for (let y = 1; y <= height; y += 1) {
    let rowTotal = 0
    for (let x = 1; x <= width; x += 1) {
      rowTotal += image.data[((y - 1) * width + x - 1) * 4]
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowTotal
    }
  }
  const radius = Math.max(12, Math.round(Math.min(width, height) / 55))
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(height - 1, y + radius)
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(width - 1, x + radius)
      const sum =
        integral[(bottom + 1) * stride + right + 1] -
        integral[top * stride + right + 1] -
        integral[(bottom + 1) * stride + left] +
        integral[top * stride + left]
      const mean = sum / ((right - left + 1) * (bottom - top + 1))
      const index = (y * width + x) * 4
      const value = image.data[index] < mean - 10 ? 0 : 255
      image.data[index] = value
      image.data[index + 1] = value
      image.data[index + 2] = value
    }
  }
  context.putImageData(image, 0, 0)
  return canvas
}

async function preprocessImage(file: File) {
  const bitmap = await createImageBitmap(file)
  const longestSide = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(2, 2200 / longestSide)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    bitmap.close()
    throw new Error('This browser could not prepare the image for OCR.')
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  stretchGreyscale(image)
  context.putImageData(image, 0, 0)
  return { standard: canvas, enhanced: () => adaptiveThreshold(canvas) }
}

function recognitionScore(text: string, application: ApplicationData) {
  const brandScore = similarity(application.brandName, bestObservedLine(application.brandName, text))
  const classScore = similarity(application.classType, bestObservedLine(application.classType, text))
  const expectedAlcohol = parseAlcohol(application.alcoholContent)
  const observedAlcohol = parseAlcohol(findAlcohol(text))
  const alcoholScore =
    expectedAlcohol.abv !== null && observedAlcohol.abv === expectedAlcohol.abv &&
    (expectedAlcohol.proof === null || observedAlcohol.proof === expectedAlcohol.proof)
      ? 1
      : 0
  const volumeScore = parseVolume(findVolume(text)) === parseVolume(application.netContents) ? 1 : 0
  const collapsed = collapseWhitespace(text)
  const warningStart = collapsed.toLowerCase().indexOf('government warning')
  const warningCandidate = warningStart >= 0
    ? collapsed.slice(warningStart, warningStart + GOVERNMENT_WARNING.length + 30)
    : ''
  const warningScore = warningCandidate ? similarity(GOVERNMENT_WARNING, warningCandidate) : 0
  return brandScore + classScore + alcoholScore + volumeScore + warningScore
}

type RecognitionPass = {
  text: string
  confidence: number
  blocks: unknown
  rotationRadians: number
  score: number
  canvas: HTMLCanvasElement
  rotatedWidth: number
  rotatedHeight: number
}

async function imageDimensions(source: string | null, fallback: HTMLCanvasElement) {
  if (!source) return { width: fallback.width, height: fallback.height }
  const image = new Image()
  image.src = source
  await image.decode()
  return { width: image.naturalWidth, height: image.naturalHeight }
}

async function runPass(
  worker: Awaited<ReturnType<typeof getWorker>>,
  canvas: HTMLCanvasElement,
  application: ApplicationData,
  options: { rotateAuto?: boolean; rotateRadians?: number },
): Promise<RecognitionPass> {
  const result = await worker.recognize(
    canvas,
    options,
    { text: true, blocks: true, imageColor: true },
  )
  const rotated = await imageDimensions(result.data.imageColor, canvas)
  return {
    text: result.data.text,
    confidence: result.data.confidence,
    blocks: result.data.blocks,
    rotationRadians: result.data.rotateRadians ?? options.rotateRadians ?? 0,
    score: recognitionScore(result.data.text, application),
    canvas,
    rotatedWidth: rotated.width,
    rotatedHeight: rotated.height,
  }
}

export async function recognizeLabel(
  file: File,
  application: ApplicationData,
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
    const passes: RecognitionPass[] = []
    passes.push(await runPass(worker, prepared.standard, application, { rotateAuto: true }))

    const attemptedOrientations = new Set<number>()
    if (passes[0].score < 1.5) {
      onProgress({ progress: 35, message: 'Checking upside-down orientation' })
      passes.push(await runPass(worker, prepared.standard, application, { rotateRadians: Math.PI }))
      attemptedOrientations.add(Math.PI)
    }

    if (Math.max(...passes.map((pass) => pass.score)) < 4.35) {
      onProgress({ progress: 30, message: 'Improving difficult text' })
      const enhanced = prepared.enhanced()
      passes.push(await runPass(worker, enhanced, application, { rotateAuto: true }))
      const orientations = [Math.PI, Math.PI / 2, -Math.PI / 2]
      for (const rotation of orientations) {
        if (attemptedOrientations.has(rotation)) continue
        if (Math.max(...passes.map((pass) => pass.score)) >= 4.35) break
        onProgress({ progress: 55, message: 'Checking label orientation' })
        passes.push(await runPass(worker, enhanced, application, { rotateRadians: rotation }))
      }
    }

    const best = passes.reduce((winner, candidate) =>
      candidate.score + candidate.confidence / 1000 > winner.score + winner.confidence / 1000
        ? candidate
        : winner,
    )
    const words = flattenWords(
      best.blocks,
      best.rotationRadians,
      best.canvas.width,
      best.canvas.height,
      best.rotatedWidth,
      best.rotatedHeight,
    ).map((word) => ({
      ...word,
      inkRatio: measureInkRatio(best.canvas, word.bbox),
    }))
    return {
      text: best.text,
      confidence: best.confidence,
      durationMs: performance.now() - startedAt,
      words,
      imageWidth: best.canvas.width,
      imageHeight: best.canvas.height,
      rotationRadians: best.rotationRadians,
      attempts: passes.length,
    }
  } catch (error) {
    await discardWorker()
    throw error
  } finally {
    progressListener = null
  }
}
