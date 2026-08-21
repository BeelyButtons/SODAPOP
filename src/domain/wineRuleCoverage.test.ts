import { describe, expect, it } from 'vitest'
import { evaluateRuleApplicability, evaluateRuleSet, type ReviewContext } from './ruleEngine'
import { RULE_SPECIFICATIONS } from './ruleSpecification'

function rule(id: string) {
  const found = RULE_SPECIFICATIONS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`Missing wine rule: ${id}`)
  return found
}

const branches: Array<{ id: string; applies: ReviewContext; excludes: ReviewContext; missing: ReviewContext; fact: string }> = [
  { id: 'wine.appellation', applies: { wineAppellation: 'NAPA VALLEY' }, excludes: { wineAppellation: '', wineVarietals: [], wineVintage: '', wineEstateBottledClaim: false }, missing: { wineAppellation: '', wineVarietals: [], wineVintage: '' }, fact: 'wineEstateBottledClaim' },
  { id: 'wine.varietal', applies: { wineVarietals: [{ name: 'MERLOT', percentage: 80 }] }, excludes: { wineVarietals: [] }, missing: {}, fact: 'wineVarietals' },
  { id: 'wine.vintage', applies: { wineVintage: '2023' }, excludes: { wineVintage: '' }, missing: {}, fact: 'wineVintage' },
  { id: 'wine.estate-bottled', applies: { wineEstateBottledClaim: true }, excludes: { wineEstateBottledClaim: false }, missing: {}, fact: 'wineEstateBottledClaim' },
  { id: 'wine.foreign-wine-percentage', applies: { wineForeignBlendReferenced: true }, excludes: { wineForeignBlendReferenced: false }, missing: {}, fact: 'wineForeignBlendReferenced' },
  { id: 'wine.country-of-origin', applies: { source: 'imported', alcoholContent: 13 }, excludes: { source: 'domestic', alcoholContent: 13 }, missing: { source: 'imported' }, fact: 'alcoholContent' },
  { id: 'wine.formula-composition', applies: { formulaCompositionStatement: 'WINE WITH NATURAL FLAVOR' }, excludes: { formulaCompositionStatement: '' }, missing: {}, fact: 'formulaCompositionStatement' },
  { id: 'wine.sulfites', applies: { sulfitesPpm: 10 }, excludes: { sulfitesPpm: 9.9 }, missing: {}, fact: 'sulfitesPpm' },
  { id: 'wine.yellow-5', applies: { containsYellow5: true }, excludes: { containsYellow5: false }, missing: {}, fact: 'containsYellow5' },
  { id: 'wine.cochineal-carmine', applies: { containsCochinealOrCarmine: true }, excludes: { containsCochinealOrCarmine: false }, missing: {}, fact: 'containsCochinealOrCarmine' },
]

describe('wine conditional rule coverage', () => {
  it.each(branches)('$id resolves applies, does-not-apply, and missing-context', ({ id, applies, excludes, missing, fact }) => {
    expect(evaluateRuleApplicability(rule(id), applies).status).toBe('applies')
    expect(evaluateRuleApplicability(rule(id), excludes).status).toBe('does_not_apply')
    expect(evaluateRuleApplicability(rule(id), missing)).toMatchObject({
      status: 'missing_context',
      missingFacts: expect.arrayContaining([fact]),
    })
  })

  it('keeps imported origin out of the domestic 7%+ rule set', () => {
    const domesticIds = evaluateRuleSet('wine-7plus-domestic', {})!.rules.map(({ rule: specification }) => specification.id)
    const importedIds = evaluateRuleSet('wine-7plus-imported', {})!.rules.map(({ rule: specification }) => specification.id)
    expect(domesticIds).not.toContain('wine.country-of-origin')
    expect(importedIds).toContain('wine.country-of-origin')
  })

  it('retains domestic Part 24 and Part 16 checks in the below-7% TTB route', () => {
    const ids = evaluateRuleSet('wine-under-7-ttb-routing', {})!.rules.map(({ rule: specification }) => specification.id)
    expect(ids).toEqual(expect.arrayContaining([
      'wine.under-seven-routing',
      'wine.under-seven-name-address',
      'wine.under-seven-brand-name',
      'wine.under-seven-alcohol-content',
      'wine.under-seven-net-contents',
      'wine.under-seven-kind-designation',
      'common.health-warning-wording',
      'common.health-warning-format',
      'common.formula-labeling-instructions',
    ]))
  })
})
