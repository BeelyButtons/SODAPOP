import {
  GOVERNMENT_WARNING,
  type ApplicationData,
  type CheckStatus,
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

function warningChecks(text: string, confidence: number, containerVolumeMl: number): ReviewCheck[] {
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
  const formatStatus: CheckStatus = uppercaseHeading ? 'needs_review' : 'mismatch'
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
    },
    {
      id: 'warningFormat',
      label: 'Government warning format',
      status: formatStatus,
      expected: `Uppercase bold heading; remaining text not bold; at least ${minimumTypeSize} mm type and no more than ${maximumCharactersPerInch} characters per inch; contrasting background and separation from other information.`,
      observed: uppercaseHeading
        ? 'Uppercase heading detected; physical formatting is not measurable from this image.'
        : 'Required uppercase heading was not detected.',
      explanation: uppercaseHeading
        ? 'Confirm bolding, type size, contrast, and separation visually. A photo has no reliable physical scale.'
        : 'The heading must read “GOVERNMENT WARNING” in uppercase before visual formatting review.',
    },
  ]
}

export function verifyLabel(input: VerificationInput): ReviewOutcome {
  const checks: ReviewCheck[] = [
    textMatchCheck('brand', 'Brand name', input.application.brandName, input.ocrText),
    textMatchCheck('classType', 'Class / type', input.application.classType, input.ocrText),
    alcoholCheck(input.application.alcoholContent, input.ocrText),
    volumeCheck(input.application.netContents, input.ocrText),
    ...warningChecks(input.ocrText, input.ocrConfidence, input.application.containerVolumeMl),
  ]

  const status: CheckStatus = checks.some((check) => check.status === 'mismatch')
    ? 'mismatch'
    : checks.some((check) => check.status === 'needs_review')
      ? 'needs_review'
      : 'pass'

  return { ...input, status, checks }
}
