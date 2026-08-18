import { describe, expect, it } from 'vitest'
import { GOVERNMENT_WARNING, INITIAL_APPLICATION } from './reviewSchema'
import { verifyLabel } from './verifyLabel'

const validOcrText = `
OLD TOM DISTILLERY
KENTUCKY STRAIGHT BOURBON WHISKEY
45% Alc./Vol. (90 Proof)
750 mL
${GOVERNMENT_WARNING}
`

function review(text = validOcrText, confidence = 95) {
  return verifyLabel({
    application: INITIAL_APPLICATION,
    ocrText: text,
    ocrConfidence: confidence,
    durationMs: 1_250,
  })
}

describe('verifyLabel', () => {
  it('passes matching application fields and exact warning text', () => {
    const outcome = review()

    expect(outcome.checks.filter((check) => check.status === 'pass')).toHaveLength(5)
    expect(outcome.checks.find((check) => check.id === 'warningFormat')?.status).toBe('needs_review')
    expect(outcome.status).toBe('needs_review')
  })

  it('treats harmless brand capitalization as a match', () => {
    const outcome = review(validOcrText.replace('OLD TOM DISTILLERY', 'Old Tom Distillery'))

    expect(outcome.checks.find((check) => check.id === 'brand')?.status).toBe('pass')
  })

  it('reports a numeric ABV mismatch', () => {
    const outcome = review(validOcrText.replace('45% Alc./Vol. (90 Proof)', '42% Alc./Vol. (84 Proof)'))

    expect(outcome.checks.find((check) => check.id === 'alcohol')).toMatchObject({
      status: 'mismatch',
      observed: expect.stringContaining('42%'),
    })
    expect(outcome.status).toBe('mismatch')
  })

  it('rejects title-case warning headings', () => {
    const outcome = review(validOcrText.replace('GOVERNMENT WARNING:', 'Government Warning:'))

    expect(outcome.checks.find((check) => check.id === 'warningText')?.status).toBe('mismatch')
    expect(outcome.checks.find((check) => check.id === 'warningFormat')?.status).toBe('mismatch')
  })

  it('refers an undetected warning to a human when OCR confidence is low', () => {
    const outcome = review('OLD TOM DISTILLERY\n45% Alc./Vol. (90 Proof)\n750 mL', 52)

    expect(outcome.checks.find((check) => check.id === 'warningText')?.status).toBe('needs_review')
  })
})
