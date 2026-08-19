import {
  GOVERNMENT_WARNING,
  type ApplicationData,
  type CheckStatus,
  type HighlightRegion,
  type OcrWord,
  type ReviewCheck,
  type ReviewOutcome,
} from './reviewSchema'
import {
  bestObservedLine,
  collapseWhitespace,
  findAlcohol,
  findVolume,
  normalizeWords,
  parseAlcohol,
  parseVolume,
  similarity,
} from './normalization'

type VerificationInput = {
  application: ApplicationData
  ocrText: string
  ocrConfidence: number
  durationMs: number
  ocrWords?: OcrWord[]
  imageWidth?: number
  imageHeight?: number
}

function normalizedToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function governmentWarningWords(words: OcrWord[]) {
  const tokens = words.map((word) => normalizedToken(word.text))
  const start = tokens.findIndex(
    (token, index) => token === 'government' && tokens[index + 1] === 'warning',
  )
  if (start < 0) return []

  let end = Math.min(words.length, start + normalizeWords(GOVERNMENT_WARNING).split(' ').length + 8)
  for (let index = start + 2; index < Math.min(words.length - 1, end); index += 1) {
    if (tokens[index] === 'health' && tokens[index + 1]?.startsWith('problem')) {
      end = index + 2
      break
    }
  }
  return words.slice(start, end)
}

export function findImproperlyBoldWarningBody(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
) {
  const warningWords = governmentWarningWords(words)
  const firstBodyWord = warningWords[2]
  if (!firstBodyWord || !imageWidth || !imageHeight) return undefined

  const firstCenter = (firstBodyWord.bbox.y0 + firstBodyWord.bbox.y1) / 2
  const firstHeight = firstBodyWord.bbox.y1 - firstBodyWord.bbox.y0
  const bodyWords = warningWords.slice(2).filter((word) => typeof word.inkRatio === 'number')
  const firstLineBody = bodyWords.filter((word) => {
    const center = (word.bbox.y0 + word.bbox.y1) / 2
    const height = word.bbox.y1 - word.bbox.y0
    return Math.abs(center - firstCenter) <= Math.max(firstHeight, height) * 0.72
  })
  const laterBody = bodyWords.filter((word) => !firstLineBody.includes(word))
  if (firstLineBody.length < 3 || laterBody.length < 6) return undefined

  const firstLineRatio = median(firstLineBody.map((word) => word.inkRatio ?? 0))
  const laterRatio = median(laterBody.map((word) => word.inkRatio ?? 0))
  const clearlyBold = firstLineRatio >= laterRatio * 1.12 && firstLineRatio - laterRatio >= 0.04
  if (!clearlyBold) return undefined

  return {
    region: {
      boxes: firstLineBody.map((word) => word.bbox),
      imageWidth,
      imageHeight,
    } satisfies HighlightRegion,
    firstLineRatio,
    laterRatio,
  }
}

export function findGovernmentWarningRegion(
  words: OcrWord[],
  imageWidth: number,
  imageHeight: number,
): HighlightRegion | undefined {
  if (!imageWidth || !imageHeight) return undefined
  const boxes = governmentWarningWords(words)
    .filter((word) => word.confidence >= 20)
    .map((word) => word.bbox)
    .filter((box) => box.x1 > box.x0 && box.y1 > box.y0)

  return boxes.length ? { boxes, imageWidth, imageHeight } : undefined
}

export function findTextRegion(
  words: OcrWord[],
  phrase: string,
  imageWidth: number,
  imageHeight: number,
): HighlightRegion | undefined {
  const target = normalizeWords(phrase)
  if (!target || !imageWidth || !imageHeight || !words.length) return undefined

  const meaningfulWords = words.filter((word) => normalizeWords(word.text))
  if (!meaningfulWords.length) return undefined

  const targetWordCount = target.split(' ').length
  const minimumWindow = Math.max(1, targetWordCount - 2)
  const maximumWindow = targetWordCount + 2
  let bestScore = 0
  let bestWords: OcrWord[] = []

  for (let start = 0; start < meaningfulWords.length; start += 1) {
    for (
      let length = minimumWindow;
      length <= maximumWindow && start + length <= meaningfulWords.length;
      length += 1
    ) {
      const candidateWords = meaningfulWords.slice(start, start + length)
      const candidate = candidateWords.map((word) => word.text).join(' ')
      const score = similarity(target, candidate)
      if (score > bestScore) {
        bestScore = score
        bestWords = candidateWords
      }
    }
  }

  if (bestScore < 0.68) return undefined
  const boxes = bestWords
    .filter((word) => word.confidence >= 20)
    .map((word) => word.bbox)
    .filter((box) => box.x1 > box.x0 && box.y1 > box.y0)

  return boxes.length ? { boxes, imageWidth, imageHeight } : undefined
}

function textMatchCheck(
  id: 'brand' | 'classType',
  label: string,
  expected: string,
  text: string,
): ReviewCheck {
  const observed = bestObservedLine(expected, text)
  const score = similarity(expected, observed)
  const normalizedFound = normalizeWords(text).includes(normalizeWords(expected))
  const status: CheckStatus = normalizedFound ? 'pass' : score >= 0.78 ? 'needs_review' : 'mismatch'

  return {
    id,
    label,
    status,
    expected,
    observed: observed || 'Not found',
    explanation:
      status === 'pass'
        ? 'The label matches after harmless capitalization and punctuation normalization.'
        : status === 'needs_review'
          ? `A possible match was found (${Math.round(score * 100)}% text similarity). Confirm visually.`
          : 'No sufficiently similar label text was found.',
  }
}

function alcoholCheck(expected: string, text: string): ReviewCheck {
  const observed = findAlcohol(text)
  const expectedValues = parseAlcohol(expected)
  const observedValues = parseAlcohol(observed)
  const abvMatches =
    expectedValues.abv !== null &&
    observedValues.abv !== null &&
    Math.abs(expectedValues.abv - observedValues.abv) < 0.01
  const proofRequired = expectedValues.proof !== null
  const proofMatches =
    !proofRequired ||
    (observedValues.proof !== null && Math.abs(expectedValues.proof! - observedValues.proof) < 0.01)
  const status: CheckStatus = abvMatches && proofMatches ? 'pass' : observed ? 'mismatch' : 'needs_review'

  return {
    id: 'alcohol',
    label: 'Alcohol content',
    status,
    expected,
    observed: observed || 'Not confidently found',
    explanation:
      status === 'pass'
        ? 'ABV and proof match the application numerically.'
        : status === 'mismatch'
          ? 'The detected ABV or proof differs from the application.'
          : 'OCR did not confidently identify an alcohol statement. Confirm visually.',
  }
}

function volumeCheck(expected: string, text: string): ReviewCheck {
  const observed = findVolume(text)
  const expectedMl = parseVolume(expected)
  const observedMl = parseVolume(observed)
  const matches =
    expectedMl !== null && observedMl !== null && Math.abs(expectedMl - observedMl) < 0.5
  const status: CheckStatus = matches ? 'pass' : observed ? 'mismatch' : 'needs_review'

  return {
    id: 'netContents',
    label: 'Net contents',
    status,
    expected,
    observed: observed || 'Not confidently found',
    explanation:
      status === 'pass'
        ? 'The detected volume matches after unit normalization.'
        : status === 'mismatch'
          ? 'The detected volume differs from the application.'
          : 'OCR did not confidently identify net contents. Confirm visually.',
  }
}

function warningChecks(
  text: string,
  confidence: number,
  containerVolumeMl: number,
  highlight?: HighlightRegion,
  improperBoldBody?: ReturnType<typeof findImproperlyBoldWarningBody>,
): ReviewCheck[] {
  const collapsed = collapseWhitespace(text)
  const exactMatch = collapsed.includes(GOVERNMENT_WARNING)
  const caseInsensitiveMatch = collapsed.toLowerCase().includes(GOVERNMENT_WARNING.toLowerCase())
  const warningStart = collapsed.toLowerCase().indexOf('government warning')
  const observed =
    warningStart >= 0
      ? collapsed.slice(warningStart, warningStart + GOVERNMENT_WARNING.length + 30)
      : ''
  const wordingSimilarity = observed ? similarity(GOVERNMENT_WARNING, observed) : 0

  let textStatus: CheckStatus = 'mismatch'
  let textExplanation = 'The required warning statement was not found.'
  if (exactMatch) {
    textStatus = 'pass'
    textExplanation = 'The OCR text matches the required federal warning exactly.'
  } else if (caseInsensitiveMatch) {
    textExplanation = 'The wording matches, but required capitalization does not.'
  } else if (wordingSimilarity >= 0.9) {
    textExplanation = 'The warning is close but not exact. Exact wording is required.'
  } else if (!observed && confidence < 65) {
    textStatus = 'needs_review'
    textExplanation = 'The warning was not detected and OCR confidence is low. Confirm visually.'
  }

  const uppercaseHeading = collapsed.includes('GOVERNMENT WARNING:')
  const formatStatus: CheckStatus = uppercaseHeading && !improperBoldBody ? 'needs_review' : 'mismatch'
  const minimumTypeSize = containerVolumeMl > 3000 ? 3 : containerVolumeMl > 237 ? 2 : 1
  const maximumCharactersPerInch = minimumTypeSize === 3 ? 12 : minimumTypeSize === 2 ? 25 : 40

  return [
    {
      id: 'warningText',
      label: 'Government warning wording',
      status: textStatus,
      expected: GOVERNMENT_WARNING,
      observed: observed || 'Not found',
      explanation: textExplanation,
      highlight,
    },
    {
      id: 'warningFormat',
      label: 'Government warning format',
      status: formatStatus,
      expected: `Uppercase bold heading; remaining text not bold; at least ${minimumTypeSize} mm type and no more than ${maximumCharactersPerInch} characters per inch; contrasting background and separation from other information.`,
      observed: improperBoldBody
        ? 'Body text immediately following the heading appears bold.'
        : uppercaseHeading
          ? 'Uppercase heading detected; remaining physical formatting requires visual confirmation.'
        : 'Required uppercase heading was not detected.',
      explanation: improperBoldBody
        ? 'Only “GOVERNMENT WARNING” may be bold. The detected bold body text does not comply.'
        : uppercaseHeading
          ? 'No clear body-bolding problem was detected. Confirm heading weight, type size, contrast, and separation visually.'
        : 'The heading must read “GOVERNMENT WARNING” in uppercase before visual formatting review.',
      highlight: improperBoldBody?.region ?? highlight,
    },
  ]
}

export function verifyLabel(input: VerificationInput): ReviewOutcome {
  const words = input.ocrWords ?? []
  const imageWidth = input.imageWidth ?? 0
  const imageHeight = input.imageHeight ?? 0
  const warningHighlight = findGovernmentWarningRegion(
    words,
    imageWidth,
    imageHeight,
  )
  const improperBoldBody = findImproperlyBoldWarningBody(words, imageWidth, imageHeight)
  const brandCheck = textMatchCheck('brand', 'Brand name', input.application.brandName, input.ocrText)
  const classTypeCheck = textMatchCheck(
    'classType',
    'Class / type',
    input.application.classType,
    input.ocrText,
  )
  const detectedAlcoholCheck = alcoholCheck(input.application.alcoholContent, input.ocrText)
  const netContentsCheck = volumeCheck(input.application.netContents, input.ocrText)

  const withDetectedHighlight = (check: ReviewCheck): ReviewCheck => {
    if (/not found|not confidently found/i.test(check.observed)) return check
    const highlight = findTextRegion(words, check.observed, imageWidth, imageHeight)
    return highlight ? { ...check, highlight } : check
  }

  const checks: ReviewCheck[] = [
    withDetectedHighlight(brandCheck),
    withDetectedHighlight(classTypeCheck),
    withDetectedHighlight(detectedAlcoholCheck),
    withDetectedHighlight(netContentsCheck),
    ...warningChecks(
      input.ocrText,
      input.ocrConfidence,
      input.application.containerVolumeMl,
      warningHighlight,
      improperBoldBody,
    ),
  ]

  const status: CheckStatus = checks.some((check) => check.status === 'mismatch')
    ? 'mismatch'
    : checks.some((check) => check.status === 'needs_review')
      ? 'needs_review'
      : 'pass'

  return { ...input, status, checks }
}
