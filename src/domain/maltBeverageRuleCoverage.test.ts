import { describe, expect, it } from 'vitest'
import { evaluateRuleApplicability, evaluateRuleSet, type ReviewContext } from './ruleEngine'
import { RULE_SPECIFICATIONS } from './ruleSpecification'

function rule(id: string) {
  const found = RULE_SPECIFICATIONS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`Missing malt-beverage rule: ${id}`)
  return found
}

const branches: Array<{ id: string; applies: ReviewContext; excludes: ReviewContext; missing: ReviewContext; fact: string }> = [
  { id: 'malt.alcohol-content', applies: { maltAlcoholFromAddedIngredients: true, labelAlcoholStatementPresent: false }, excludes: { maltAlcoholFromAddedIngredients: false, labelAlcoholStatementPresent: false }, missing: { labelAlcoholStatementPresent: false }, fact: 'maltAlcoholFromAddedIngredients' },
  { id: 'malt.specialty-composition', applies: { maltSpecialtyProduct: true }, excludes: { maltSpecialtyProduct: false }, missing: {}, fact: 'maltSpecialtyProduct' },
  { id: 'malt.alcohol-characterization-claims', applies: { maltAlcoholCharacterizationClaim: true }, excludes: { maltAlcoholCharacterizationClaim: false }, missing: {}, fact: 'maltAlcoholCharacterizationClaim' },
  { id: 'malt.country-of-origin', applies: { source: 'imported' }, excludes: { source: 'domestic' }, missing: {}, fact: 'source' },
  { id: 'malt.import-bottling-disposition', applies: { source: 'imported', maltPostImportBottling: true }, excludes: { source: 'imported', maltPostImportBottling: false }, missing: { source: 'imported' }, fact: 'maltPostImportBottling' },
  { id: 'malt.geographic-designation', applies: { maltGeographicClaim: true }, excludes: { maltGeographicClaim: false }, missing: {}, fact: 'maltGeographicClaim' },
  { id: 'malt.yellow-5', applies: { containsYellow5: true }, excludes: { containsYellow5: false }, missing: {}, fact: 'containsYellow5' },
  { id: 'malt.cochineal-carmine', applies: { containsCochinealOrCarmine: true }, excludes: { containsCochinealOrCarmine: false }, missing: {}, fact: 'containsCochinealOrCarmine' },
  { id: 'malt.sulfites', applies: { sulfitesPpm: 10 }, excludes: { sulfitesPpm: 9.9 }, missing: {}, fact: 'sulfitesPpm' },
  { id: 'malt.aspartame', applies: { containsAspartame: true }, excludes: { containsAspartame: false }, missing: {}, fact: 'containsAspartame' },
]

describe('malt-beverage conditional rule coverage', () => {
  it.each(branches)('$id resolves applies, does-not-apply, and missing-context', ({ id, applies, excludes, missing, fact }) => {
    expect(evaluateRuleApplicability(rule(id), applies).status).toBe('applies')
    expect(evaluateRuleApplicability(rule(id), excludes).status).toBe('does_not_apply')
    expect(evaluateRuleApplicability(rule(id), missing)).toMatchObject({
      status: 'missing_context',
      missingFacts: expect.arrayContaining([fact]),
    })
  })

  it('keeps import-only origin and disposition rules out of the domestic rule set', () => {
    const domesticIds = evaluateRuleSet('malt-beverage-domestic', {})!.rules.map(({ rule: specification }) => specification.id)
    const importedIds = evaluateRuleSet('malt-beverage-imported', {})!.rules.map(({ rule: specification }) => specification.id)
    expect(domesticIds).not.toContain('malt.country-of-origin')
    expect(domesticIds).not.toContain('malt.import-bottling-disposition')
    expect(importedIds).toEqual(expect.arrayContaining(['malt.country-of-origin', 'malt.import-bottling-disposition']))
  })
})
