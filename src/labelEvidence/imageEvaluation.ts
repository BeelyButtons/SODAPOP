import { collapseWhitespace, similarity } from '../domain/normalization'
import { verifyLabel } from '../domain/verifyLabel'
import type { OcrWord, ReviewCheck, ReviewOutcome } from '../domain/reviewSchema'
import { recognizeLabel, type OcrProgress } from '../ocr/recognizeLabel'
import { createCaseImageFile, applicationDataForCase } from './caseImage'
import { createEvidenceQuestions, type EvidenceQuestion } from './evidenceQuestions'
import type { CaseEvaluation, LabelEvidenceCase, ReviewCheckResult, ReviewFlag } from './types'

export interface ImageCaseEvaluation extends CaseEvaluation {
  durationMs: number
  rulesDurationMs: number
  ocrConfidence: number
  imageUrl: string
  imageFile: File
  questions: EvidenceQuestion[]
  outcome: ReviewOutcome
}

function normalized(value: string) { return collapseWhitespace(value).toLocaleLowerCase() }

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function warningWords(words: OcrWord[]) {
  const tokens = words.map((word) => word.text.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const start = tokens.findIndex((token, index) => token === 'government' && tokens[index + 1] === 'warning')
  if (start < 0) return []
  const health = tokens.findIndex((token, index) => index > start && token === 'health' && tokens[index + 1]?.startsWith('problem'))
  return words.slice(start, health > start ? health + 2 : start + 65)
}

async function warningPresentation(file: File, words: OcrWord[], width: number, height: number) {
  const warning = warningWords(words)
  const heading = warning.slice(0, 2)
  const body = warning.slice(2)
  const headingInk = median(heading.map((word) => word.inkRatio ?? 0).filter(Boolean))
  const bodyInk = median(body.map((word) => word.inkRatio ?? 0).filter(Boolean))
  const bodyHeightPx = median(body.map((word) => word.bbox.y1 - word.bbox.y0).filter((value) => value > 0))
  const bodyHeightMm = bodyHeightPx * ((6 * 25.4) / height)
  const lines = new Map<string, OcrWord[]>()
  body.forEach((word, index) => {
    const key = word.lineId ?? `word-${index}`
    lines.set(key, [...(lines.get(key) ?? []), word])
  })
  const densities = [...lines.values()].filter((line) => line.length > 1).map((line) => {
    const lineWidthPx = Math.max(...line.map((word) => word.bbox.x1)) - Math.min(...line.map((word) => word.bbox.x0))
    const lineWidthInches = (lineWidthPx / width) * 4
    return line.map((word) => word.text.length).reduce((sum, value) => sum + value, 0) / Math.max(lineWidthInches, .1)
  })
  const warningTop = Math.min(...warning.map((word) => word.bbox.y0))
  const previousBottom = Math.max(0, ...words.filter((word) => !warning.includes(word) && word.bbox.y1 < warningTop).map((word) => word.bbox.y1))

  let contrastMet = false
  if (warning.length && width && height) {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context) {
      context.drawImage(bitmap, 0, 0, width, height)
      const x0 = Math.max(0, Math.min(...warning.map((word) => word.bbox.x0)) - 8)
      const y0 = Math.max(0, Math.min(...warning.map((word) => word.bbox.y0)) - 8)
      const x1 = Math.min(width, Math.max(...warning.map((word) => word.bbox.x1)) + 8)
      const y1 = Math.min(height, Math.max(...warning.map((word) => word.bbox.y1)) + 8)
      const pixels = context.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data
      let darkest = 255
      let lightest = 0
      for (let index = 0; index < pixels.length; index += 16) {
        const luminance = .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2]
        darkest = Math.min(darkest, luminance)
        lightest = Math.max(lightest, luminance)
      }
      contrastMet = lightest - darkest >= 100
    }
    bitmap.close()
  }

  return {
    headingBold: headingInk > 0 && bodyInk > 0 && headingInk >= bodyInk * 1.025,
    bodyNotBold: bodyInk > 0,
    minimumTypeSizeMet: bodyHeightMm >= 2,
    densityMet: densities.length > 0 && Math.max(...densities) <= 25,
    contrastMet,
    separated: warningTop - previousBottom >= height * .025,
  }
}

function questionWasRead(question: EvidenceQuestion, text: string) {
  const observed = normalized(text)
  if (question.exactText) return question.expected.every((value) => observed.includes(normalized(value)))
  return question.expected.some((value) => observed.includes(normalized(value)) || similarity(value, text) >= .72)
}

function checkMatchesQuestion(check: ReviewCheck, question: EvidenceQuestion) {
  const checkKey = `${check.id} ${check.label}`.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  const questionKey = `${question.id} ${question.label}`.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  const meaningful = question.id.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  const checkId = check.id.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
  return (meaningful.length >= 4 && checkKey.includes(meaningful)) || (checkId.length >= 4 && questionKey.includes(checkId))
}

function canonicalCheckKey(check: ReviewCheck) {
  const id = `${check.id} ${check.ruleId ?? ''} ${check.label}`.toLowerCase()
  if (/warning.*word|health-warning-wording/.test(id)) return 'government-warning-wording'
  if (/warning.*format|health-warning-format/.test(id)) return 'government-warning-format'
  if (/brand-name|\bbrand\b/.test(id) && !/brand-label|placement/.test(id)) return 'brand-name'
  if (/class-type|class \/ type|class or type/.test(id)) return 'class-type'
  if (/net-contents|net contents/.test(id)) return 'net-contents'
  if (/alcohol-content|alcohol content/.test(id)) return 'alcohol-content'
  return check.id
}

function deduplicateChecks(checks: ReviewCheck[]) {
  const rank = { pass: 0, needs_review: 1, mismatch: 2 }
  const unique = new Map<string, ReviewCheck>()
  for (const check of checks) {
    const key = canonicalCheckKey(check)
    const current = unique.get(key)
    if (!current || rank[check.status] > rank[current.status] || (rank[check.status] === rank[current.status] && check.ruleId && !current.ruleId)) unique.set(key, check)
  }
  return [...unique.values()]
}

function ensureQuestionChecks(outcome: ReviewOutcome, questions: EvidenceQuestion[]) {
  const checks = [...outcome.checks]
  for (const question of questions) {
    if (checks.some((check) => checkMatchesQuestion(check, question))) continue
    const found = questionWasRead(question, outcome.ocrText)
    checks.push({
      id: `question-${question.id}`,
      ruleId: question.ruleId,
      label: question.label,
      status: found ? 'pass' : 'needs_review',
      expected: question.expected.join(' · '),
      observed: found ? 'Expected evidence detected in OCR text' : 'Not confidently found',
      explanation: found
        ? 'The required evidence was read from the submitted label image.'
        : `LabelEvidence could not verify this required item from the submitted image. OCR confidence was ${Math.round(outcome.ocrConfidence)}%. Confirm it directly on the label.`,
    })
  }
  return checks
}

function optionalClaimChecks(item: LabelEvidenceCase, ocrText: string): ReviewCheck[] {
  const checks: ReviewCheck[] = []
  const healthClaim = ocrText.match(/\b(?:healthy|healthful|good for your health|supports wellness)\b/i)?.[0]
  if (healthClaim) checks.push({
    id: 'optional-health-claim',
    ruleId: 'common.optional-information',
    label: 'Health-related claim',
    status: 'mismatch',
    expected: 'Optional statements must not imply that alcohol is healthy or offers a health benefit.',
    observed: healthClaim,
    explanation: 'The image contains a health-related representation that requires correction rather than routine substantiation.',
  })
  const organicClaim = ocrText.match(/\b(?:USDA\s+)?organic\b/i)?.[0]
  if (organicClaim) {
    const support = item.evidence.some((record) => record.type === 'organic' && record.status === 'available')
    checks.push({
      id: 'optional-organic-claim',
      ruleId: 'common.optional-information',
      label: 'Organic claim support',
      status: support ? 'pass' : 'mismatch',
      expected: 'A current product-specific organic certification in the application evidence.',
      observed: organicClaim,
      explanation: support ? 'The optional organic claim has corresponding certification evidence.' : 'The label makes an organic claim, but the application packet does not contain supporting organic certification.',
    })
  }
  return checks
}

function checkToFlag(check: ReviewCheck): ReviewFlag {
  const uncertain = check.status === 'needs_review'
  return {
    id: check.id,
    kind: uncertain ? 'image_quality' : check.ruleId?.includes('optional') ? 'claim' : 'mismatch',
    title: uncertain ? `${check.label} could not be verified` : `${check.label} may not comply`,
    detail: check.explanation,
    applicationValue: check.expected || undefined,
    labelValue: check.observed || undefined,
  }
}

function checkToResult(check: ReviewCheck): ReviewCheckResult {
  return { id: check.id, label: check.label, status: check.status === 'pass' ? 'confirmed' : 'flagged', detail: check.explanation }
}

export async function evaluateImageCase(item: LabelEvidenceCase, onProgress: (progress: OcrProgress) => void): Promise<ImageCaseEvaluation> {
  const application = applicationDataForCase(item)
  const { selection, questions } = createEvidenceQuestions(application)
  const imageFile = await createCaseImageFile(item)
  const ocr = await recognizeLabel(imageFile, application, onProgress, questions)
  const presentation = await warningPresentation(imageFile, ocr.words, ocr.imageWidth, ocr.imageHeight)
  const rulesStarted = performance.now()
  const initialOutcome = verifyLabel({
    application,
    ocrText: ocr.text,
    ocrConfidence: ocr.confidence,
    durationMs: ocr.durationMs,
    ocrWords: ocr.words,
    imageWidth: ocr.imageWidth,
    imageHeight: ocr.imageHeight,
    ocrAttempts: ocr.attempts,
    ocrRotationDegrees: (ocr.rotationRadians * 180) / Math.PI,
    ocrPassTimingsMs: ocr.passTimingsMs,
    ocrRetryReason: ocr.retryReason,
    ruleSelection: selection,
    warningPresentation: presentation,
  })
  const questionChecks = ensureQuestionChecks(initialOutcome, questions)
  const claimChecks = optionalClaimChecks(item, initialOutcome.ocrText)
  const checks = deduplicateChecks([
    ...(claimChecks.length ? questionChecks.filter((check) => check.id !== 'common.optional-information') : questionChecks),
    ...claimChecks,
  ])
  const rulesDurationMs = performance.now() - rulesStarted
  const outcome: ReviewOutcome = {
    ...initialOutcome,
    checks,
    status: checks.some((check) => check.status === 'mismatch') ? 'mismatch' : checks.some((check) => check.status === 'needs_review') ? 'needs_review' : 'pass',
  }
  return {
    caseId: item.id,
    categoryId: item.category.id,
    flags: checks.filter((check) => check.status !== 'pass').map(checkToFlag),
    checks: checks.map(checkToResult),
    reviewedAt: new Date().toISOString(),
    durationMs: ocr.durationMs + rulesDurationMs,
    rulesDurationMs,
    ocrConfidence: ocr.confidence,
    imageUrl: URL.createObjectURL(imageFile),
    imageFile,
    questions,
    outcome,
  }
}
