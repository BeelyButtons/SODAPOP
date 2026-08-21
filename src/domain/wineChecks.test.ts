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
    durationMs: 900,
    ...(ruleSetId ? { ruleSelection: overrideRuleSet(automatic, context, ruleSetId) } : {}),
  })
}

function review(id: string, text: string, ruleSetId?: string, confidence = 94) {
  return reviewApplication(applicationFor(id), text, ruleSetId, confidence)
}

const domesticText = `
RIDGE & RIVER
2023
NAPA VALLEY
CABERNET SAUVIGNON
13.5% Alc. by Vol.
750 mL
CONTAINS SULFITES
BOTTLED BY RIDGE & RIVER WINERY, ST. HELENA, CALIFORNIA
${GOVERNMENT_WARNING}
`

const estateText = `
STONE ARBOR
ESTATE BOTTLED
SONOMA VALLEY
CHARDONNAY
12.8% Alc. by Vol.
750 mL
CONTAINS SULFITES
BOTTLED BY STONE ARBOR ESTATE, SONOMA, CALIFORNIA
${GOVERNMENT_WARNING}
`

const importedText = `
MONTCLAIRE
2022
BORDEAUX
RED WINE
PRODUCT OF FRANCE
13% Alc. by Vol.
750 mL
CONTAINS SULFITES
IMPORTED BY ATLANTIC CELLARS IMPORTS, NEWARK, NEW JERSEY
${GOVERNMENT_WARNING}
`

const formulaText = `
ORCHARD BLOOM
WINE SPECIALTY
APPLE WINE WITH NATURAL CHERRY FLAVOR
11% Alc. by Vol.
750 mL
CONTAINS FD&C YELLOW NO. 5
CONTAINS SULFITES
CONTAINS CARMINE
BOTTLED BY ORCHARD BLOOM WINERY, ITHACA, NEW YORK
${GOVERNMENT_WARNING}
`

const underSevenText = `
LIGHTHOUSE CIDER
APPLE WINE
6.5% Alc. by Vol.
355 mL
BOTTLED BY LIGHTHOUSE CIDER HOUSE, PORTLAND, MAINE
${GOVERNMENT_WARNING}
`

describe('wine reviewer cards', () => {
  it('passes supported domestic appellation, varietal, vintage, and sulfite evidence', () => {
    const outcome = review('wine-domestic-complete', domesticText)
    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('wine-7plus-domestic')
    for (const id of ['wine.brand-name', 'wine.class-type-designation', 'wine.alcohol-content', 'wine.name-address', 'wine.net-contents', 'wine.appellation', 'wine.varietal', 'wine.vintage', 'wine.sulfites']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('fails a single-varietal designation supported below the ordinary 75% minimum', () => {
    const outcome = review('wine-varietal-support-conflict', domesticText)
    expect(outcome.checks.find((check) => check.id === 'wine.varietal')).toMatchObject({
      status: 'mismatch',
      explanation: expect.stringContaining('ordinary minimum is 75%'),
    })
  })

  it('passes multiple varieties only when every percentage appears and totals 100%', () => {
    const application = {
      ...applicationFor('wine-domestic-complete'),
      classType: '60% CABERNET SAUVIGNON 40% MERLOT',
      wineVarietals: [
        { name: 'CABERNET SAUVIGNON', percentage: 60 },
        { name: 'MERLOT', percentage: 40 },
      ],
    }
    const text = domesticText.replace('CABERNET SAUVIGNON', '60% CABERNET SAUVIGNON 40% MERLOT')
    const outcome = reviewApplication(application, text)
    expect(outcome.checks.find((check) => check.id === 'wine.varietal')?.status).toBe('pass')
  })

  it('fails an AVA appellation supported below 85%', () => {
    const application = { ...applicationFor('wine-domestic-complete'), wineAppellationPercentage: 80 }
    const outcome = reviewApplication(application, domesticText)
    expect(outcome.checks.find((check) => check.id === 'wine.appellation')?.status).toBe('mismatch')
  })

  it('fails an AVA vintage supported below 95%', () => {
    const application = { ...applicationFor('wine-domestic-complete'), wineVintagePercentage: 90 }
    const outcome = reviewApplication(application, domesticText)
    expect(outcome.checks.find((check) => check.id === 'wine.vintage')?.status).toBe('mismatch')
  })

  it('passes a fully supported estate-bottled claim', () => {
    const outcome = review('wine-estate-complete', estateText)
    expect(outcome.checks.find((check) => check.id === 'wine.estate-bottled')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'wine.appellation')?.status).toBe('pass')
  })

  it('returns missing context instead of failing when estate production evidence is absent', () => {
    const application = { ...applicationFor('wine-estate-complete'), wineEstateProductionContinuous: undefined }
    const outcome = reviewApplication(application, estateText)
    expect(outcome.checks.find((check) => check.id === 'wine.estate-bottled')?.status).toBe('needs_review')
  })

  it('passes imported origin, appellation, vintage, and importer evidence', () => {
    const outcome = review('wine-imported-complete', importedText)
    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('wine-7plus-imported')
    for (const id of ['wine.name-address', 'wine.country-of-origin', 'wine.appellation', 'wine.vintage']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('fails a readable imported-country conflict', () => {
    const outcome = review('wine-imported-origin-conflict', importedText.replace('PRODUCT OF FRANCE', 'PRODUCT OF ITALY'))
    expect(outcome.checks.find((check) => check.id === 'wine.country-of-origin')?.status).toBe('mismatch')
  })

  it('checks the exact percentage when a domestic/foreign wine blend references foreign wine', () => {
    const application = {
      ...applicationFor('wine-domestic-complete'),
      wineForeignBlendReferenced: true,
      wineForeignPercentage: 25,
    }
    expect(reviewApplication(application, `${domesticText}\n25% FOREIGN WINE`).checks.find((check) => check.id === 'wine.foreign-wine-percentage')?.status).toBe('pass')
    expect(reviewApplication(application, `${domesticText}\n30% FOREIGN WINE`).checks.find((check) => check.id === 'wine.foreign-wine-percentage')?.status).toBe('mismatch')
  })

  it('returns missing context when imported appellation/vintage foreign-law support is absent', () => {
    const application = { ...applicationFor('wine-imported-complete'), wineForeignLawCompliant: undefined }
    const outcome = reviewApplication(application, importedText)
    expect(outcome.checks.find((check) => check.id === 'wine.appellation')?.status).toBe('needs_review')
    expect(outcome.checks.find((check) => check.id === 'wine.vintage')?.status).toBe('needs_review')
  })

  it('passes formula composition, sulfite, Yellow No. 5, and carmine declarations', () => {
    const outcome = review('wine-formula-complete', formulaText)
    for (const id of ['common.formula-labeling-instructions', 'wine.formula-composition', 'wine.sulfites', 'wine.yellow-5', 'wine.cochineal-carmine']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('fails readable artwork that omits required formula and additive statements', () => {
    const stripped = formulaText
      .replace('APPLE WINE WITH NATURAL CHERRY FLAVOR', '')
      .replace('CONTAINS FD&C YELLOW NO. 5', '')
      .replace('CONTAINS SULFITES', '')
      .replace('CONTAINS CARMINE', '')
    const outcome = review('wine-formula-missing', stripped)
    for (const id of ['common.formula-labeling-instructions', 'wine.formula-composition', 'wine.sulfites', 'wine.yellow-5', 'wine.cochineal-carmine']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('mismatch')
    }
  })

  it('fails a readable formula-composition conflict', () => {
    const outcome = review('wine-formula-conflict', formulaText.replace('NATURAL CHERRY FLAVOR', 'ARTIFICIAL CHERRY FLAVOR'))
    expect(outcome.checks.find((check) => check.id === 'wine.formula-composition')?.status).toBe('mismatch')
    expect(outcome.checks.find((check) => check.id === 'common.formula-labeling-instructions')?.status).toBe('mismatch')
  })

  it('applies wine alcohol tolerances without crossing the 14% taxable-grade boundary', () => {
    expect(review('wine-domestic-complete', domesticText.replace('13.5%', '12.4%')).checks.find((check) => check.id === 'wine.alcohol-content')?.status).toBe('pass')
    expect(review('wine-domestic-complete', domesticText.replace('13.5%', '11.5%')).checks.find((check) => check.id === 'wine.alcohol-content')?.status).toBe('mismatch')
    const overFourteen = { ...applicationFor('wine-domestic-complete'), alcoholContent: '14.5% Alc. by Vol.' }
    expect(reviewApplication(overFourteen, domesticText).checks.find((check) => check.id === 'wine.alcohol-content')?.status).toBe('mismatch')
  })

  it('accepts TABLE WINE instead of a number from 7% through 14%', () => {
    const application = { ...applicationFor('wine-domestic-complete'), classType: 'TABLE WINE', wineVarietals: undefined, wineVintage: undefined, wineAppellation: undefined }
    const outcome = reviewApplication(application, domesticText.replace('CABERNET SAUVIGNON', 'TABLE WINE').replace('13.5% Alc. by Vol.', ''))
    expect(outcome.checks.find((check) => check.id === 'wine.alcohol-content')?.status).toBe('pass')
  })

  it('rejects ABV as the abbreviation in a numerical wine statement', () => {
    const outcome = review('wine-domestic-complete', domesticText.replace('13.5% Alc. by Vol.', '13.5% ABV'))
    expect(outcome.checks.find((check) => check.id === 'wine.alcohol-content')?.status).toBe('mismatch')
  })

  it('accepts authorized sulfite wording and rejects prohibited “sulfite free” wording', () => {
    expect(review('wine-domestic-complete', domesticText.replace('CONTAINS SULFITES', 'CONTAINS NATURALLY OCCURRING SULFITES')).checks.find((check) => check.id === 'wine.sulfites')?.status).toBe('pass')
    const noSulfites = { ...applicationFor('wine-domestic-complete'), sulfitesPpm: 0 }
    expect(reviewApplication(noSulfites, domesticText.replace('CONTAINS SULFITES', 'SULFITE FREE')).checks.find((check) => check.id === 'common.optional-information')?.status).toBe('mismatch')
  })

  it('keeps domestic below-7% Part 24 cards alongside the TTB routing and warning cards', () => {
    const outcome = review('wine-under-seven-complete', underSevenText)
    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('wine-under-7-ttb-routing')
    for (const id of ['wine.under-seven-routing', 'wine.under-seven-name-address', 'wine.under-seven-brand-name', 'wine.under-seven-alcohol-content', 'wine.under-seven-net-contents', 'wine.under-seven-kind-designation']) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('does not apply domestic Part 24 premises cards to an imported below-7% routing case', () => {
    const application = { ...applicationFor('wine-under-seven-complete'), source: 'imported' as const }
    const outcome = reviewApplication(application, underSevenText)
    expect(outcome.checks.map((check) => check.id)).toEqual([
      'wine.under-seven-routing',
      'common.health-warning-wording',
      'common.health-warning-format',
    ])
  })

  it('flags missing domestic below-7% kind and premises statements', () => {
    const stripped = underSevenText.replace('APPLE WINE', '').replace('BOTTLED BY LIGHTHOUSE CIDER HOUSE, PORTLAND, MAINE', '')
    const outcome = review('wine-under-seven-missing', stripped)
    expect(outcome.checks.find((check) => check.id === 'wine.under-seven-name-address')?.status).toBe('mismatch')
    expect(outcome.checks.find((check) => check.id === 'wine.under-seven-kind-designation')?.status).not.toBe('pass')
  })
})
