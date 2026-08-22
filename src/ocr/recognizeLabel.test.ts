import { describe, expect, it } from 'vitest'
import { GOVERNMENT_WARNING, type ApplicationData, type OcrWord } from '../domain/reviewSchema'
import {
  mergeRecognitionText,
  mergeRecognitionWords,
  MAX_RECOGNITION_PASSES,
  recognitionEvidence,
  shouldRetryRecognition,
  shouldTryOrientationRecovery,
  type RecognitionEvidence,
} from './recognizeLabel'

function evidence(coverage: number, missingIds: string[]): RecognitionEvidence {
  return { coverage, matchedWeight: coverage * 5, totalWeight: 5, missingIds }
}

const maltApplication: ApplicationData = {
  productType: 'malt_beverage',
  source: 'domestic',
  brandName: 'HIGHLINE BREWING',
  classType: 'LAGER',
  alcoholContent: '5.2% Alc. by Vol.',
  netContents: '12 FL OZ',
  containerVolumeMl: 354.882,
  permitName: 'HIGHLINE BREWING COMPANY',
  permitAddress: 'DENVER, COLORADO',
  labelAlcoholStatementPresent: false,
  maltAlcoholFromAddedIngredients: false,
}

describe('OCR retry quality gate', () => {
  it('caps full-image recognition work at two passes', () => {
    expect(MAX_RECOGNITION_PASSES).toBe(2)
  })

  it('stops after a strong high-confidence pass with one obstructed core field', () => {
    expect(shouldRetryRecognition(evidence(0.8, ['net-contents']), 95)).toBe(false)
  })

  it('retries when the same partial evidence is low confidence', () => {
    expect(shouldRetryRecognition(evidence(0.65, ['net-contents', 'responsible-party']), 62)).toBe(true)
  })

  it('retries materially incomplete evidence regardless of overall confidence', () => {
    expect(shouldRetryRecognition(evidence(0.5, ['brand', 'class-type', 'government-warning']), 95)).toBe(true)
  })

  it('does not penalize a standard malt beverage for omitting optional alcohol content', () => {
    const text = `HIGHLINE BREWING\nLAGER\n12 FL OZ\nBREWED AND CANNED BY HIGHLINE BREWING COMPANY, DENVER, COLORADO\n${GOVERNMENT_WARNING}`
    const result = recognitionEvidence(text, maltApplication)
    expect(result.missingIds).not.toContain('alcohol-content')
    expect(result.coverage).toBe(1)
    expect(shouldRetryRecognition(result, 80)).toBe(false)
  })

  it('does not expect a government warning below 0.5% alcohol', () => {
    const application = {
      ...maltApplication,
      brandName: 'CLEAR CURRENT',
      classType: 'MALT BEVERAGE',
      alcoholContent: '0.4% Alc. by Vol.',
      labelAlcoholStatementPresent: true,
      maltAlcoholCharacterizationClaim: true,
    }
    const text = 'CLEAR CURRENT\nNON-ALCOHOLIC CONTAINS LESS THAN 0.5 PERCENT ALCOHOL BY VOLUME\nMALT BEVERAGE\n12 FL OZ\nHIGHLINE BREWING COMPANY'
    const result = recognitionEvidence(text, application)
    expect(result.missingIds).not.toContain('government-warning')
    expect(result.coverage).toBe(1)
  })

  it('expects numerical alcohol evidence for distilled spirits', () => {
    const application: ApplicationData = {
      ...maltApplication,
      productType: 'distilled_spirits',
      brandName: 'OLD TOM',
      classType: 'BOURBON WHISKEY',
      alcoholContent: '45% Alc. by Vol.',
      netContents: '750 mL',
      permitName: 'OLD TOM DISTILLERY',
    }
    const result = recognitionEvidence(`OLD TOM\nBOURBON WHISKEY\n750 mL\nOLD TOM DISTILLERY\n${GOVERNMENT_WARNING}`, application)
    expect(result.missingIds).toContain('alcohol-content')
  })

  it('does not penalize 7-to-14-percent wine when a numerical alcohol statement is not required', () => {
    const application: ApplicationData = {
      ...maltApplication,
      productType: 'wine',
      brandName: 'VALLEY THREAD',
      classType: 'RED WINE',
      alcoholContent: '13% Alc. by Vol.',
      netContents: '750 mL',
      permitName: 'VALLEY THREAD WINERY',
    }
    const text = `VALLEY THREAD\nRED WINE\n750 mL\nVALLEY THREAD WINERY\n${GOVERNMENT_WARNING}`
    expect(recognitionEvidence(text, application).missingIds).not.toContain('alcohol-content')
  })

  it('expects numerical alcohol evidence for wine below 7 percent', () => {
    const application: ApplicationData = {
      ...maltApplication,
      productType: 'wine',
      brandName: 'ORCHARD LINE',
      classType: 'APPLE WINE',
      alcoholContent: '6.5% Alc. by Vol.',
      netContents: '750 mL',
      permitName: 'ORCHARD LINE WINERY',
    }
    const text = `ORCHARD LINE\nAPPLE WINE\n750 mL\nORCHARD LINE WINERY\n${GOVERNMENT_WARNING}`
    expect(recognitionEvidence(text, application).missingIds).toContain('alcohol-content')
  })

  it('accepts equivalent metric and U.S. volume statements within rounding tolerance', () => {
    const application = { ...maltApplication, netContents: '11.2 FL OZ (330 mL)' }
    const text = `HIGHLINE BREWING\nLAGER\n330 mL\nHIGHLINE BREWING COMPANY\n${GOVERNMENT_WARNING}`
    expect(recognitionEvidence(text, application).missingIds).not.toContain('net-contents')
  })

  it('expects country-of-origin evidence for imported products', () => {
    const application = {
      ...maltApplication,
      source: 'imported' as const,
      importCountryOfOrigin: 'BELGIUM',
    }
    const text = `HIGHLINE BREWING\nLAGER\n12 FL OZ\nHIGHLINE BREWING COMPANY\n${GOVERNMENT_WARNING}`
    expect(recognitionEvidence(text, application).missingIds).toContain('country-of-origin')
  })

  it('scores formula and specialty evidence when those rules apply', () => {
    const application = {
      ...maltApplication,
      brandName: 'CITRUS STATIC',
      classType: 'MALT BEVERAGE WITH NATURAL TANGERINE FLAVOR',
      fancifulName: 'POP ORBIT',
      formulaCompositionStatement: 'MALT BEVERAGE WITH NATURAL TANGERINE FLAVOR',
      formulaLabelingInstructions: 'MALT BEVERAGE WITH NATURAL TANGERINE FLAVOR|CONTAINS SULFITES',
      maltSpecialtyProduct: true,
      maltAlcoholFromAddedIngredients: true,
    }
    const result = recognitionEvidence('CITRUS STATIC\nPOP ORBIT\n12 FL OZ', application)
    expect(result.missingIds).toEqual(expect.arrayContaining(['class-type', 'formula-composition', 'formula-instruction-2']))
    expect(shouldRetryRecognition(result, 90)).toBe(true)
  })

  it('reserves explicit orientation recovery for nearly empty low-confidence results', () => {
    expect(shouldTryOrientationRecovery(evidence(0.2, ['brand', 'class-type']), 40, 'x')).toBe(true)
    expect(shouldTryOrientationRecovery(evidence(0.55, ['brand']), 40, 'some readable label text')).toBe(false)
  })

  it('merges complementary pass text without duplicating the same line', () => {
    expect(mergeRecognitionText([
      'HIGHLINE BREWING\nLAGER',
      'LAGER\nGOVERNMENT WARNING',
    ])).toBe('HIGHLINE BREWING\nLAGER\nGOVERNMENT WARNING')
  })

  it('deduplicates overlapping words while retaining the more confident coordinates', () => {
    const first: OcrWord = { text: 'LAGER', confidence: 60, bbox: { x0: 10, y0: 10, x1: 80, y1: 35 } }
    const stronger: OcrWord = { text: 'LAGER', confidence: 92, bbox: { x0: 11, y0: 10, x1: 81, y1: 35 } }
    const warning: OcrWord = { text: 'WARNING', confidence: 88, bbox: { x0: 10, y0: 90, x1: 120, y1: 120 } }
    expect(mergeRecognitionWords([[first], [stronger, warning]])).toEqual([stronger, warning])
  })
})
