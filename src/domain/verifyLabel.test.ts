import { describe, expect, it } from 'vitest'
import { GOVERNMENT_WARNING, INITIAL_APPLICATION, type OcrWord } from './reviewSchema'
import { findImproperlyBoldWarningBody, verifyLabel } from './verifyLabel'

const validOcrText = `
OLD TOM DISTILLERY
KENTUCKY STRAIGHT BOURBON WHISKEY
45% Alc./Vol. (90 Proof)
750 mL
AGED 4 YEARS
BOTTLED BY OLD TOM DISTILLERY, FRANKFORT, KENTUCKY
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
  function warningWords(firstLineRatio: number): OcrWord[] {
    const firstLine = [
      'GOVERNMENT',
      'WARNING:',
      '(1)',
      'According',
      'to',
      'the',
      'Surgeon',
      'General,',
      'women',
      'should',
      'not',
    ]
    const laterLines = [
      ['drink', 'alcoholic', 'beverages', 'during', 'pregnancy', 'because'],
      ['Consumption', 'impairs', 'your', 'ability', 'to', 'drive'],
    ]
    const words: OcrWord[] = firstLine.map((text, index) => ({
      text,
      confidence: 96,
      inkRatio: index < 2 ? 0.51 : firstLineRatio,
      bbox: { x0: 10 + index * 35, y0: 100, x1: 38 + index * 35, y1: 118 },
    }))
    laterLines.forEach((line, lineIndex) => {
      words.push(
        ...line.map((text, index) => ({
          text,
          confidence: 96,
          inkRatio: 0.39,
          bbox: {
            x0: 10 + index * 45,
            y0: 135 + lineIndex * 35,
            x1: 45 + index * 45,
            y1: 153 + lineIndex * 35,
          },
        })),
      )
    })
    return words
  }

  it('does not flag a normally weighted warning body as bold', () => {
    expect(findImproperlyBoldWarningBody(warningWords(0.4), 500, 300)).toBeUndefined()
  })

  it('flags and locates a warning body that is materially bolder than later lines', () => {
    const result = findImproperlyBoldWarningBody(warningWords(0.47), 500, 300)

    expect(result?.region.boxes).toHaveLength(9)
  })

  it('passes matching application fields and exact warning text', () => {
    const outcome = review()

    expect(outcome.checks.filter((check) => check.status === 'pass').length).toBeGreaterThanOrEqual(5)
    expect(outcome.checks.find((check) => check.id === 'warningFormat')?.status).toBe('needs_review')
    expect(outcome.checks.find((check) => check.id === 'warningFormat')?.requirements).toEqual(expect.arrayContaining([
      'Minimum type size: 2 mm',
      'Maximum density: 25 characters per inch',
    ]))
    expect(outcome.status).toBe('needs_review')
  })

  it('uses only TTB warning checks for wine below seven percent', () => {
    const outcome = verifyLabel({
      application: {
        ...INITIAL_APPLICATION,
        productType: 'wine',
        alcoholContent: '6.5% Alc. by Vol.',
      },
      ocrText: validOcrText,
      ocrConfidence: 95,
      durationMs: 1_250,
    })

    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('wine-under-7-ttb-routing')
    expect(outcome.checks.map((check) => check.id)).toEqual(['warningText', 'warningFormat'])
  })

  it('treats harmless brand capitalization as a match', () => {
    const outcome = review(validOcrText.replace('OLD TOM DISTILLERY', 'Old Tom Distillery'))

    expect(outcome.checks.find((check) => check.id === 'brand')?.status).toBe('pass')
  })

  it('does not silently discard a required brand ampersand', () => {
    const outcome = verifyLabel({
      application: { ...INITIAL_APPLICATION, brandName: 'EMBER & ASH' },
      ocrText: validOcrText.replace('OLD TOM DISTILLERY', 'EMBER ASH'),
      ocrConfidence: 95,
      durationMs: 1_250,
    })

    expect(outcome.checks.find((check) => check.id === 'brand')).toMatchObject({
      status: 'needs_review',
      explanation: expect.stringContaining('ampersand'),
    })
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

  it('does not call an undetected warning a confirmed mismatch solely from high OCR confidence', () => {
    const outcome = review('OLD TOM DISTILLERY\n45% Alc./Vol. (90 Proof)\n750 mL', 94)

    expect(outcome.checks.find((check) => check.id === 'warningText')?.status).toBe('needs_review')
    expect(outcome.checks.find((check) => check.id === 'warningFormat')?.status).toBe('needs_review')
  })

  it('flags an explicit responsibility statement that replaces the federal warning', () => {
    const outcome = review(`${validOcrText.split('GOVERNMENT WARNING:')[0]}PLEASE ENJOY RESPONSIBLY.`, 94)

    expect(outcome.checks.find((check) => check.id === 'warningText')?.status).toBe('mismatch')
  })

  it('refers a partially detected alcohol statement to staff instead of inventing a mismatch', () => {
    const outcome = review(validOcrText.replace('45% Alc./Vol. (90 Proof)', '45% Alc./Vol.'))

    expect(outcome.checks.find((check) => check.id === 'alcohol')?.status).toBe('needs_review')
  })

  it('attaches OCR coordinates to both government warning checks', () => {
    const ocrWords: OcrWord[] = ['GOVERNMENT', 'WARNING:', 'health', 'problems.'].map(
      (text, index) => ({
        text,
        confidence: 96,
        bbox: { x0: index * 20, y0: 80, x1: index * 20 + 16, y1: 96 },
      }),
    )
    const outcome = verifyLabel({
      application: INITIAL_APPLICATION,
      ocrText: validOcrText,
      ocrConfidence: 95,
      durationMs: 1_250,
      ocrWords,
      imageWidth: 200,
      imageHeight: 300,
    })

    expect(outcome.checks.find((check) => check.id === 'warningText')?.highlight?.boxes).toHaveLength(4)
    expect(outcome.checks.find((check) => check.id === 'warningFormat')?.highlight?.boxes).toHaveLength(4)
    expect(outcome.checks.find((check) => check.id === 'brand')?.highlight).toBeUndefined()
  })

  it('attaches coordinates to each detected application value', () => {
    const wordLines = [
      ['OLD', 'TOM', 'DISTILLERY'],
      ['KENTUCKY', 'STRAIGHT', 'BOURBON', 'WHISKEY'],
      ['45%', 'Alc./Vol.', '(90', 'Proof)'],
      ['750', 'mL'],
    ]
    const ocrWords: OcrWord[] = wordLines.flatMap((line, lineIndex) =>
      line.map((text, wordIndex) => ({
        text,
        confidence: 95,
        bbox: {
          x0: 20 + wordIndex * 50,
          y0: 20 + lineIndex * 30,
          x1: 60 + wordIndex * 50,
          y1: 40 + lineIndex * 30,
        },
      })),
    )
    const outcome = verifyLabel({
      application: INITIAL_APPLICATION,
      ocrText: validOcrText,
      ocrConfidence: 95,
      durationMs: 1_250,
      ocrWords,
      imageWidth: 400,
      imageHeight: 500,
    })

    expect(outcome.checks.find((check) => check.id === 'brand')?.highlight?.boxes).toHaveLength(3)
    expect(outcome.checks.find((check) => check.id === 'classType')?.highlight?.boxes).toHaveLength(4)
    expect(outcome.checks.find((check) => check.id === 'alcohol')?.highlight?.boxes).toHaveLength(4)
    expect(outcome.checks.find((check) => check.id === 'netContents')?.highlight?.boxes).toHaveLength(2)
  })
})
