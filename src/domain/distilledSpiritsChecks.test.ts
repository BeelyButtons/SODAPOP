import { describe, expect, it } from 'vitest'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import { GOVERNMENT_WARNING } from './reviewSchema'
import { overrideRuleSet, reviewContextFromApplication, selectAutomaticRuleSet } from './ruleEngine'
import { verifyLabel } from './verifyLabel'

function applicationFor(id: string) {
  return SAMPLE_LABELS.find((sample) => sample.id === id)!.application
}

function review(id: string, text: string, ruleSetId?: string) {
  const application = applicationFor(id)
  const automatic = selectAutomaticRuleSet(reviewContextFromApplication(application), '2026-08-20T00:00:00.000Z')
  return verifyLabel({
    application,
    ocrText: text,
    ocrConfidence: 94,
    durationMs: 900,
    ...(ruleSetId ? { ruleSelection: overrideRuleSet(automatic, reviewContextFromApplication(application), ruleSetId) } : {}),
  })
}

const importedText = `
NORTH SEA RESERVE
SINGLE MALT SCOTCH WHISKY
46% Alc./Vol. (92 Proof)
700 mL
AGED 8 YEARS
PRODUCT OF SCOTLAND
IMPORTED BY ATLANTIC IMPORTS LLC, BALTIMORE, MARYLAND
${GOVERNMENT_WARNING}
`

const conditionalText = `
CITRUS FORGE
DISTILLED SPIRITS SPECIALTY
GOLDEN CITRUS
ORANGE LIQUEUR WITH NATURAL FLAVORS
30% Alc./Vol. (60 Proof)
750 mL
CONTAINS FD&C YELLOW NO. 5
CONTAINS SULFITES
PHENYLKETONURICS: CONTAINS PHENYLALANINE
BOTTLED BY CITRUS FORGE SPIRITS, TAMPA, FLORIDA
${GOVERNMENT_WARNING}
`

describe('expanded distilled-spirits reviewer cards', () => {
  it('adds imported name/address, country, and supported age cards', () => {
    const outcome = review('imported-clear', importedText)

    expect(outcome.ruleSelection?.selectedRuleSetId).toBe('distilled-spirits-imported')
    expect(outcome.checks.find((check) => check.id === 'spirits.name-address')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'spirits.country-of-origin')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'spirits.age-statement')?.status).toBe('pass')
  })

  it('fails a readable country-of-origin conflict', () => {
    const outcome = review('imported-origin-mismatch', importedText.replace('PRODUCT OF SCOTLAND', 'PRODUCT OF IRELAND'))

    expect(outcome.checks.find((check) => check.id === 'spirits.country-of-origin')).toMatchObject({
      status: 'mismatch',
      explanation: expect.stringContaining('conflicts with the packet country'),
    })
  })

  it('passes applicable formula and additive declarations when present', () => {
    const outcome = review('conditional-disclosures', conditionalText)

    for (const id of [
      'common.formula-labeling-instructions',
      'spirits.specialty-composition',
      'spirits.yellow-5',
      'spirits.sulfites',
      'spirits.aspartame',
    ]) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('fails required conditional declarations that readable artwork omits', () => {
    const stripped = conditionalText
      .replace('CONTAINS FD&C YELLOW NO. 5', '')
      .replace('CONTAINS SULFITES', '')
      .replace('PHENYLKETONURICS: CONTAINS PHENYLALANINE', '')
    const outcome = review('conditional-missing', stripped)

    expect(outcome.checks.find((check) => check.id === 'spirits.yellow-5')?.status).toBe('mismatch')
    expect(outcome.checks.find((check) => check.id === 'spirits.sulfites')?.status).toBe('mismatch')
    expect(outcome.checks.find((check) => check.id === 'spirits.aspartame')?.status).toBe('mismatch')
  })

  it('surfaces absent permit and production facts as missing context', () => {
    const outcome = review('missing-context', `PACKET GAP\nVODKA\n40% Alc./Vol. (80 Proof)\n750 mL\n${GOVERNMENT_WARNING}`)

    expect(outcome.checks.find((check) => check.id === 'spirits.name-address')).toMatchObject({
      status: 'needs_review',
      observed: expect.stringContaining('Missing context'),
    })
    expect(outcome.checks.some((check) => check.observed.includes('Missing context'))).toBe(true)
  })

  it('can correct an intentionally wrong automatic branch using cached evidence', () => {
    const automatic = review('routing-override', importedText.replace('NORTH SEA RESERVE', 'ROUTING CHECK'))
    const corrected = review(
      'routing-override',
      importedText.replace('NORTH SEA RESERVE', 'ROUTING CHECK'),
      'distilled-spirits-imported',
    )

    expect(automatic.ruleSelection?.selectedRuleSetId).toBe('distilled-spirits-domestic')
    expect(automatic.checks.some((check) => check.id === 'spirits.country-of-origin')).toBe(false)
    expect(corrected.ruleSelection?.selectedRuleSetId).toBe('distilled-spirits-imported')
    expect(corrected.checks.find((check) => check.id === 'spirits.country-of-origin')?.status).toBe('pass')
  })

  it('evaluates neutral spirits, wood treatment, State, and carmine disclosures', () => {
    const outcome = review('production-disclosures', `
      WOODLAND PROOF
      AMERICAN WHISKEY SPECIALTY
      40% Alc./Vol. (80 Proof)
      750 mL
      AMERICAN WHISKEY WITH NATURAL FLAVORS
      50% NEUTRAL SPIRITS DISTILLED FROM CORN
      COLORED AND FLAVORED WITH OAK CHIPS
      DISTILLED IN KENTUCKY
      CONTAINS CARMINE
      BOTTLED BY WOODLAND PROOF DISTILLING, LEXINGTON, KENTUCKY
      ${GOVERNMENT_WARNING}
    `)

    for (const id of [
      'spirits.neutral-spirits-commodity',
      'spirits.wood-treatment',
      'spirits.state-of-distillation',
      'spirits.cochineal-carmine',
    ]) {
      expect(outcome.checks.find((check) => check.id === id)?.status, id).toBe('pass')
    }
  })

  it('recognizes the special alcohol statement for significant solids', () => {
    const outcome = review('significant-solids', `
      ORCHARD ORBIT
      CHERRY LIQUEUR
      CHERRY LIQUEUR WITH WHOLE CHERRIES
      BOTTLED AT 24 PERCENT ALCOHOL BY VOLUME
      750 mL
      BOTTLED BY ORCHARD ORBIT SPIRITS, TRAVERSE CITY, MICHIGAN
      ${GOVERNMENT_WARNING}
    `)

    expect(outcome.checks.find((check) => check.id === 'alcohol')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'spirits.significant-solids-alcohol')?.status).toBe('pass')
  })

  it('checks domestic exemption eligibility, State limitation, and distinctive-bottle evidence', () => {
    const outcome = review('exemption-distinctive', `
      COMMONWEALTH
      VODKA
      40% Alc./Vol. (80 Proof)
      750 mL
      FOR SALE IN VIRGINIA ONLY
      BOTTLED BY COMMONWEALTH SPIRITS, RICHMOND, VIRGINIA
      ${GOVERNMENT_WARNING}
    `)

    expect(outcome.checks.find((check) => check.id === 'common.exemption-eligibility')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'common.exemption-state-limitation')?.status).toBe('pass')
    expect(outcome.checks.find((check) => check.id === 'spirits.distinctive-bottle')?.status).toBe('pass')
  })
})
