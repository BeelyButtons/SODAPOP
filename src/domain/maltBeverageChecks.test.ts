import { describe, expect, it } from 'vitest'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import { GOVERNMENT_WARNING, type ApplicationData } from './reviewSchema'
import { overrideRuleSet, reviewContextFromApplication, selectAutomaticRuleSet } from './ruleEngine'
import { verifyLabel } from './verifyLabel'

function applicationFor(id: string) {
  return SAMPLE_LABELS.find((sample) => sample.id === id)!.application
}

function reviewApplication(application: ApplicationData, text: string, ruleSetId?: string, confidence = 94) {
  const context = reviewContextFromApplication(application)
  const automatic = selectAutomaticRuleSet(context, '2026-08-21T00:00:00.000Z')
  return verifyLabel({
    application,
    ocrText: text,
    ocrConfidence: confidence,
    durationMs: 850,
    ...(ruleSetId ? { ruleSelection: overrideRuleSet(automatic, context, ruleSetId) } : {}),
  })
}

function review(id: string, text: string, confidence = 94) {
  return reviewApplication(applicationFor(id), text, undefined, confidence)
}

const domesticText = `
HIGHLINE BREWING
LAGER
12 FL OZ
BREWED AND CANNED BY HIGHLINE BREWING COMPANY, DENVER, COLORADO
${GOVERNMENT_WARNING}
`

const importedText = `
KRONENFELD
PILSNER BEER
4.8% ALC. BY VOL.
11.2 FL OZ (330 mL)
PRODUCT OF GERMANY
IMPORTED BY NORTH ATLANTIC BEVERAGE IMPORTS, BOSTON, MASSACHUSETTS
${GOVERNMENT_WARNING}
`

const specialtyText = `
CITRUS STATIC
POP ORBIT
MALT BEVERAGE WITH NATURAL TANGERINE FLAVOR AND ARTIFICIAL COLOR
6.0% ALC. BY VOL.
12 FL OZ
CONTAINS FD&C YELLOW NO. 5
CONTAINS SULFITES
CONTAINS CARMINE
PHENYLKETONURICS: CONTAINS PHENYLALANINE
BREWED AND CANNED BY CITRUS STATIC BREW LAB, AUSTIN, TEXAS
${GOVERNMENT_WARNING}
`

describe('malt-beverage reviewer cards', () => {
  it('passes a standard domestic lager without forcing an optional alcohol card', () => {
    const outcome = review('malt-domestic-lager', domesticText)
    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('malt-beverage-domestic')
    expect(outcome.checks.map((check) => check.id)).not.toContain('malt.alcohol-content')
    for (const id of ['malt.brand-name', 'malt.class-type-designation', 'malt.net-contents', 'malt.name-address', 'malt.mandatory-language-location']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('requires U.S. net-content units instead of metric alone', () => {
    const application = { ...applicationFor('malt-domestic-lager'), netContents: '355 mL' }
    const outcome = reviewApplication(application, domesticText.replace('12 FL OZ', '355 mL'))
    expect(outcome.checks.find((check) => check.id === 'malt.net-contents')).toMatchObject({ status: 'mismatch' })
  })

  it('passes imported responsible-party and country evidence', () => {
    const outcome = review('malt-imported-pilsner', importedText)
    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('malt-beverage-imported')
    for (const id of ['malt.name-address', 'malt.country-of-origin', 'malt.alcohol-content']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
    expect(outcome.checks.map((check) => check.id)).not.toContain('malt.import-bottling-disposition')
  })

  it('keeps an application-declared alcohol statement in scope when OCR misses it', () => {
    const outcome = review('malt-imported-pilsner', importedText.replace('4.8% ALC. BY VOL.', ''), 40)
    expect(outcome.checks.find((check) => check.id === 'malt.alcohol-content')).toMatchObject({
      status: 'needs_review',
      observed: 'Alcohol statement not found',
    })
  })

  it('fails a readable imported-country conflict', () => {
    const outcome = review('malt-imported-origin-conflict', importedText.replace('PRODUCT OF GERMANY', 'PRODUCT OF AUSTRIA'))
    expect(outcome.checks.find((check) => check.id === 'malt.country-of-origin')?.status).toBe('mismatch')
  })

  it('applies the malt alcohol tolerance and rejects ABV, ranges, and thresholds', () => {
    expect(review('malt-imported-pilsner', importedText.replace('4.8%', '5.1%')).checks.find((check) => check.id === 'malt.alcohol-content')?.status).toBe('pass')
    expect(review('malt-imported-pilsner', importedText.replace('4.8%', '5.2%')).checks.find((check) => check.id === 'malt.alcohol-content')?.status).toBe('mismatch')
    expect(review('malt-imported-pilsner', importedText.replace('4.8% ALC. BY VOL.', '4.8% ABV')).checks.find((check) => check.id === 'malt.alcohol-content')?.status).toBe('mismatch')
    expect(review('malt-imported-pilsner', importedText.replace('4.8% ALC. BY VOL.', '4.5% TO 5.0% ALCOHOL BY VOLUME')).checks.find((check) => check.id === 'malt.alcohol-content')?.status).toBe('mismatch')
  })

  it('passes complete specialty identity, formula, and additive evidence', () => {
    const outcome = review('malt-specialty-complete', specialtyText)
    for (const id of ['common.formula-labeling-instructions', 'malt.class-type-designation', 'malt.specialty-composition', 'malt.alcohol-content', 'malt.yellow-5', 'malt.cochineal-carmine', 'malt.sulfites', 'malt.aspartame']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('fails readable specialty artwork that omits required statements', () => {
    const stripped = specialtyText
      .replace('POP ORBIT', '')
      .replace('MALT BEVERAGE WITH NATURAL TANGERINE FLAVOR AND ARTIFICIAL COLOR', '')
      .replace('CONTAINS FD&C YELLOW NO. 5', '')
      .replace('CONTAINS SULFITES', '')
      .replace('CONTAINS CARMINE', '')
      .replace('PHENYLKETONURICS: CONTAINS PHENYLALANINE', '')
    const outcome = review('malt-specialty-missing', stripped)
    for (const id of ['common.formula-labeling-instructions', 'malt.specialty-composition', 'malt.yellow-5', 'malt.cochineal-carmine', 'malt.sulfites', 'malt.aspartame']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('mismatch')
    }
  })

  it('fails a readable specialty composition conflict', () => {
    const outcome = review('malt-specialty-conflict', specialtyText.replace('NATURAL TANGERINE', 'ARTIFICIAL TANGERINE'))
    expect(outcome.checks.find((check) => check.id === 'malt.specialty-composition')?.status).toBe('mismatch')
    expect(outcome.checks.find((check) => check.id === 'common.formula-labeling-instructions')?.status).toBe('mismatch')
  })

  it('passes a supported non-alcoholic claim and omits the Part 16 warning cards below 0.5%', () => {
    const text = `CLEAR CURRENT\nNON-ALCOHOLIC CONTAINS LESS THAN 0.5 PERCENT ALCOHOL BY VOLUME\nMALT BEVERAGE\n12 FL OZ\nBREWED AND CANNED BY HIGHLINE BREWING COMPANY, DENVER, COLORADO`
    const outcome = review('malt-non-alcoholic', text)
    expect(outcome.checks.find((check) => check.id === 'malt.alcohol-characterization-claims')?.status).toBe('pass')
    expect(outcome.checks.map((check) => check.id)).not.toContain('common.health-warning-wording')
  })

  it('fails a low-alcohol claim at 2.5% or more', () => {
    const text = `SMALL SIGNAL\nLOW ALCOHOL\nMALT BEVERAGE\n2.6% ALC. BY VOL.\n12 FL OZ\nBREWED AND CANNED BY HIGHLINE BREWING COMPANY, DENVER, COLORADO\n${GOVERNMENT_WARNING}`
    expect(review('malt-low-alcohol-conflict', text).checks.find((check) => check.id === 'malt.alcohol-characterization-claims')?.status).toBe('mismatch')
  })

  it('distinguishes a qualified U.S. Belgian-style ale from an unqualified geographic designation', () => {
    const qualified = `COMPASS HOUSE\nBELGIAN STYLE ALE\n12 FL OZ\nBREWED AND CANNED BY HIGHLINE BREWING COMPANY, DENVER, COLORADO\n${GOVERNMENT_WARNING}`
    expect(review('malt-geographic-qualified', qualified).checks.find((check) => check.id === 'malt.geographic-designation')?.status).toBe('pass')
    expect(review('malt-geographic-conflict', qualified.replace('BELGIAN STYLE ALE', 'BELGIAN ALE')).checks.find((check) => check.id === 'malt.geographic-designation')?.status).toBe('mismatch')
  })

  it('passes imported-and-canned wording for U.S. canning without further production', () => {
    const text = `SIERRA CROSSING\nLAGER\n4.5% ALC. BY VOL.\n12 FL OZ (355 mL)\nPRODUCT OF MEXICO\nIMPORTED AND CANNED IN THE UNITED STATES BY BORDERLAND BEVERAGE COMPANY, SAN DIEGO, CALIFORNIA\n${GOVERNMENT_WARNING}`
    const outcome = review('malt-post-import-complete', text)
    expect(outcome.checks.find((check) => check.id === 'malt.import-bottling-disposition')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'malt.country-of-origin')?.status).toBe('pass')
  })

  it('switches to domestic responsible-party wording after further U.S. production', () => {
    const application = {
      ...applicationFor('malt-post-import-complete'),
      importBottlingDisposition: 'Blended and packed in the United States after importation',
    }
    const text = `SIERRA CROSSING\nLAGER\n4.5% ALC. BY VOL.\n12 FL OZ (355 mL)\nPRODUCT OF MEXICO\nPACKED BY BORDERLAND BEVERAGE COMPANY, SAN DIEGO, CALIFORNIA\n${GOVERNMENT_WARNING}`
    const outcome = reviewApplication(application, text)
    expect(outcome.checks.find((check) => check.id === 'malt.name-address')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'malt.import-bottling-disposition')?.status).toBe('pass')
  })

  it('keeps genuinely missing malt context amber rather than silently dropping it', () => {
    const application = { ...applicationFor('malt-specialty-complete'), maltAlcoholFromAddedIngredients: undefined }
    const outcome = reviewApplication(application, specialtyText)
    expect(outcome.checks.find((check) => check.id === 'malt.alcohol-content')?.status).toBe('pass')
    const withoutDisplayedAlcohol = reviewApplication(application, specialtyText.replace('6.0% ALC. BY VOL.', ''))
    expect(withoutDisplayedAlcohol.checks.find((check) => check.id === 'malt.alcohol-content')?.status).toBe('needs_review')
  })

  it('rejects prohibited sulfite-absence and misleading beverage-identity wording', () => {
    expect(review('malt-domestic-lager', `${domesticText}\nSULFITE FREE`).checks.find((check) => check.id === 'common.optional-information')?.status).toBe('mismatch')
    expect(review('malt-domestic-lager', `${domesticText}\nBOURBON-FLAVORED LAGER`).checks.find((check) => check.id === 'common.optional-information')?.status).toBe('mismatch')
  })
})
