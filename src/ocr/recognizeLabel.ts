import { createWorker, OEM, PSM, type LoggerMessage } from 'tesseract.js'
import {
  bestObservedLine,
  collapseWhitespace,
  findAlcohol,
  findVolume,
  normalizeWords,
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

export async function warmOcrEngine() {
  await getWorker()
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
  passId = '0',
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
          lineId: `${passId}-${blockIndex}-${paragraphIndex}-${lineIndex}`,
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

type EvidenceExpectation = {
  id: string
  weight: number
  matched: boolean
}

export type RecognitionEvidence = {
  coverage: number
  matchedWeight: number
  totalWeight: number
  missingIds: string[]
}

function phraseDetected(expected: string | undefined, text: string, minimumSimilarity = 0.76) {
  if (!expected?.trim()) return false
  const normalizedExpected = collapseWhitespace(expected).toLowerCase()
  const normalizedText = collapseWhitespace(text).toLowerCase()
  return normalizedText.includes(normalizedExpected)
    || similarity(expected, bestObservedLine(expected, text)) >= minimumSimilarity
}

function warningExpected(application: ApplicationData) {
  const abv = parseAlcohol(application.alcoholContent).abv
  return abv !== null && abv >= 0.5
}

function numericalAlcoholExpected(application: ApplicationData) {
  const abv = parseAlcohol(application.alcoholContent).abv
  if (application.productType === 'distilled_spirits') return true
  if (application.productType === 'malt_beverage') {
    return application.maltAlcoholFromAddedIngredients === true
      || application.labelAlcoholStatementPresent === true
  }
  return abv !== null && (abv < 7 || abv > 14 || application.labelAlcoholStatementPresent === true)
}

function volumeEvidenceDetected(text: string, application: ApplicationData) {
  const observed = parseVolume(findVolume(text))
  const expected = parseVolume(application.netContents)
  if (observed === null || expected === null) return false
  return Math.abs(observed - expected) <= Math.max(1.5, expected * 0.005)
}

function alcoholEvidenceDetected(text: string, application: ApplicationData) {
  if (findAlcohol(text)) return true
  if (application.maltAlcoholCharacterizationClaim) {
    return /\b(?:low alcohol|reduced alcohol|non[- ]alcoholic|alcohol free)\b/i.test(text)
  }
  return false
}

function recognitionExpectations(text: string, application: ApplicationData): EvidenceExpectation[] {
  const expectations: EvidenceExpectation[] = [
    { id: 'brand', weight: 1, matched: phraseDetected(application.brandName, text) },
    { id: 'class-type', weight: 1, matched: phraseDetected(application.classType, text) },
    {
      id: 'net-contents',
      weight: 0.9,
      matched: volumeEvidenceDetected(text, application),
    },
  ]

  if (warningExpected(application)) {
    const collapsed = collapseWhitespace(text)
    const warningStart = collapsed.toLowerCase().indexOf('government warning')
    const warningCandidate = warningStart >= 0
      ? collapsed.slice(warningStart, warningStart + GOVERNMENT_WARNING.length + 30)
      : ''
    expectations.push({
      id: 'government-warning',
      weight: 1.25,
      matched: Boolean(warningCandidate && similarity(GOVERNMENT_WARNING, warningCandidate) >= 0.68),
    })
  }

  if (numericalAlcoholExpected(application)) {
    expectations.push({ id: 'alcohol-content', weight: 0.9, matched: alcoholEvidenceDetected(text, application) })
  }

  const responsibleName = application.permitName || application.applicantName
  if (responsibleName) expectations.push({ id: 'responsible-party', weight: 0.75, matched: phraseDetected(responsibleName, text, 0.72) })
  if (application.source === 'imported' && application.importCountryOfOrigin) {
    expectations.push({ id: 'country-of-origin', weight: 0.75, matched: phraseDetected(application.importCountryOfOrigin, text, 0.72) })
  }
  if (application.fancifulName) expectations.push({ id: 'fanciful-name', weight: 0.55, matched: phraseDetected(application.fancifulName, text) })
  if (application.formulaCompositionStatement) {
    expectations.push({ id: 'formula-composition', weight: 0.9, matched: phraseDetected(application.formulaCompositionStatement, text, 0.7) })
  }
  for (const [index, instruction] of (application.formulaLabelingInstructions?.split('|') ?? []).entries()) {
    if (!instruction.trim() || instruction === application.formulaCompositionStatement) continue
    expectations.push({ id: `formula-instruction-${index + 1}`, weight: 0.35, matched: phraseDetected(instruction, text, 0.72) })
  }
  if (application.maltAlcoholCharacterizationClaim) {
    expectations.push({
      id: 'alcohol-characterization-claim',
      weight: 0.65,
      matched: /\b(?:low alcohol|reduced alcohol|non[- ]alcoholic|alcohol free)\b/i.test(text),
    })
  }
  if (application.wineAppellation) expectations.push({ id: 'wine-appellation', weight: 0.45, matched: phraseDetected(application.wineAppellation, text) })
  if (application.wineVintage) expectations.push({ id: 'wine-vintage', weight: 0.35, matched: phraseDetected(application.wineVintage, text) })

  return expectations
}

export function recognitionEvidence(text: string, application: ApplicationData): RecognitionEvidence {
  const expectations = recognitionExpectations(text, application)
  const totalWeight = expectations.reduce((total, expectation) => total + expectation.weight, 0)
  const matchedWeight = expectations.reduce((total, expectation) => total + (expectation.matched ? expectation.weight : 0), 0)
  return {
    coverage: totalWeight ? matchedWeight / totalWeight : 1,
    matchedWeight,
    totalWeight,
    missingIds: expectations.filter((expectation) => !expectation.matched).map((expectation) => expectation.id),
  }
}

type RecognitionPass = {
  text: string
  confidence: number
  blocks: unknown
  rotationRadians: number
  evidence: RecognitionEvidence
  canvas: HTMLCanvasElement
  rotatedWidth: number
  rotatedHeight: number
  durationMs: number
}

export function shouldRetryRecognition(evidence: RecognitionEvidence, confidence: number) {
  if (evidence.coverage >= 0.88) return false
  if (evidence.coverage >= 0.72 && confidence >= 60) return false
  if (evidence.missingIds.length <= 1 && confidence >= 78) return false
  return true
}

export function shouldTryOrientationRecovery(evidence: RecognitionEvidence, confidence: number, text: string) {
  return evidence.coverage < 0.3 && confidence < 55 && collapseWhitespace(text).length < 80
}

export function mergeRecognitionText(texts: string[]) {
  const merged: string[] = []
  for (const text of texts) {
    for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
      const duplicate = merged.some((existing) => {
        const normalizedExisting = collapseWhitespace(existing).toLowerCase()
        const normalizedLine = collapseWhitespace(line).toLowerCase()
        return normalizedExisting === normalizedLine || similarity(existing, line) >= 0.94
      })
      if (!duplicate) merged.push(line)
    }
  }
  return merged.join('\n')
}

function boxIntersectionRatio(left: OcrBox, right: OcrBox) {
  const x0 = Math.max(left.x0, right.x0)
  const y0 = Math.max(left.y0, right.y0)
  const x1 = Math.min(left.x1, right.x1)
  const y1 = Math.min(left.y1, right.y1)
  if (x1 <= x0 || y1 <= y0) return 0
  const intersection = (x1 - x0) * (y1 - y0)
  const leftArea = Math.max(1, (left.x1 - left.x0) * (left.y1 - left.y0))
  const rightArea = Math.max(1, (right.x1 - right.x0) * (right.y1 - right.y0))
  return intersection / Math.min(leftArea, rightArea)
}

export function mergeRecognitionWords(wordSets: OcrWord[][]) {
  const merged: OcrWord[] = []
  for (const word of wordSets.flat()) {
    const duplicateIndex = merged.findIndex((existing) =>
      normalizeWords(existing.text) === normalizeWords(word.text)
      && boxIntersectionRatio(existing.bbox, word.bbox) >= 0.55,
    )
    if (duplicateIndex < 0) merged.push(word)
    else if (word.confidence > merged[duplicateIndex].confidence) merged[duplicateIndex] = word
  }
  return merged
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
  options: { rotateAuto?: boolean; rotateRadians?: number; pageSegMode?: PSM },
): Promise<RecognitionPass> {
  const passStartedAt = performance.now()
  const { pageSegMode = PSM.SPARSE_TEXT, ...recognizeOptions } = options
  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
    preserve_interword_spaces: '1',
  })
  const result = await worker.recognize(
    canvas,
    recognizeOptions,
    { text: true, blocks: true, imageColor: true },
  )
  const rotated = await imageDimensions(result.data.imageColor, canvas)
  return {
    text: result.data.text,
    confidence: result.data.confidence,
    blocks: result.data.blocks,
    rotationRadians: result.data.rotateRadians ?? recognizeOptions.rotateRadians ?? 0,
    evidence: recognitionEvidence(result.data.text, application),
    canvas,
    rotatedWidth: rotated.width,
    rotatedHeight: rotated.height,
    durationMs: performance.now() - passStartedAt,
  }
}

const OCR_RESULT_BUDGET_MS = 4_800
const SECOND_PASS_START_CUTOFF_MS = 3_100
const BUDGET_TIMEOUT_MESSAGE = 'OCR recovery pass exceeded the result budget.'
export const MAX_RECOGNITION_PASSES = 2

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
    let attemptsStarted = 1
    let retryReason: string | undefined
    passes.push(await runPass(worker, prepared.standard, application, { rotateAuto: true }))

    const firstPass = passes[0]
    const elapsedAfterFirstPass = performance.now() - startedAt
    if (
      shouldRetryRecognition(firstPass.evidence, firstPass.confidence)
      && elapsedAfterFirstPass < SECOND_PASS_START_CUTOFF_MS
    ) {
      const orientationRecovery = shouldTryOrientationRecovery(firstPass.evidence, firstPass.confidence, firstPass.text)
      retryReason = orientationRecovery
        ? 'Very limited upright evidence suggested an upside-down image.'
        : `Required evidence remained unresolved: ${firstPass.evidence.missingIds.join(', ')}.`
      onProgress({ progress: 55, message: orientationRecovery ? 'Checking image orientation' : 'Recovering difficult text' })
      const remainingBudget = Math.max(250, OCR_RESULT_BUDGET_MS - (performance.now() - startedAt))
      attemptsStarted = Math.min(attemptsStarted + 1, MAX_RECOGNITION_PASSES)
      try {
        const recoveryCanvas = orientationRecovery ? prepared.standard : prepared.enhanced()
        const recoveryOptions = orientationRecovery
          ? { rotateRadians: Math.PI, pageSegMode: PSM.SPARSE_TEXT }
          : { rotateAuto: true, pageSegMode: PSM.AUTO }
        passes.push(await withTimeout(
          runPass(worker, recoveryCanvas, application, recoveryOptions),
          remainingBudget,
          BUDGET_TIMEOUT_MESSAGE,
        ))
      } catch (error) {
        if (!(error instanceof Error) || error.message !== BUDGET_TIMEOUT_MESSAGE) throw error
        retryReason += ' The recovery pass reached the time budget, so LabelEvidence returned the first-pass evidence.'
        void discardWorker()
      }
    } else if (shouldRetryRecognition(firstPass.evidence, firstPass.confidence)) {
      retryReason = 'The first pass used the recovery budget, so LabelEvidence returned its best available evidence without another full scan.'
    }

    const best = passes.reduce((winner, candidate) =>
      candidate.evidence.coverage + candidate.confidence / 1000 > winner.evidence.coverage + winner.confidence / 1000
        ? candidate
        : winner,
    )
    const orderedPasses = [best, ...passes.filter((pass) => pass !== best)]
    const words = mergeRecognitionWords(orderedPasses.map((pass, passIndex) =>
      flattenWords(
        pass.blocks,
        pass.rotationRadians,
        prepared.standard.width,
        prepared.standard.height,
        pass.rotatedWidth,
        pass.rotatedHeight,
        String(passIndex),
      ).map((word) => ({
        ...word,
        inkRatio: measureInkRatio(prepared.standard, word.bbox),
      })),
    ))
    return {
      text: mergeRecognitionText(orderedPasses.map((pass) => pass.text)),
      confidence: best.confidence,
      durationMs: performance.now() - startedAt,
      words,
      imageWidth: prepared.standard.width,
      imageHeight: prepared.standard.height,
      rotationRadians: best.rotationRadians,
      attempts: attemptsStarted,
      passTimingsMs: passes.map((pass) => pass.durationMs),
      retryReason,
    }
  } catch (error) {
    await discardWorker()
    throw error
  } finally {
    progressListener = null
  }
}
