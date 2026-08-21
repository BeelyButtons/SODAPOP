import { describe, expect, it } from 'vitest'
import { evaluateRuleApplicability, evaluateRuleSet, type ReviewContext } from './ruleEngine'
import { RULE_SPECIFICATIONS } from './ruleSpecification'

function rule(id: string) {
  const found = RULE_SPECIFICATIONS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`Missing rule specification: ${id}`)
  return found
}

const conditionalBranches: Array<{
  id: string
  applies: ReviewContext
  doesNotApply: ReviewContext
  missing: ReviewContext
  missingFact: string
}> = [
  { id: 'common.formula-labeling-instructions', applies: { formulaRequired: true }, doesNotApply: { formulaRequired: false }, missing: {}, missingFact: 'formulaRequired' },
  { id: 'common.exemption-eligibility', applies: { applicationType: 'exemption' }, doesNotApply: { applicationType: 'cola' }, missing: {}, missingFact: 'applicationType' },
  { id: 'common.exemption-state-limitation', applies: { applicationType: 'exemption' }, doesNotApply: { applicationType: 'cola' }, missing: {}, missingFact: 'applicationType' },
  { id: 'spirits.distinctive-bottle', applies: { distinctiveBottleRequested: true }, doesNotApply: { distinctiveBottleRequested: false }, missing: {}, missingFact: 'distinctiveBottleRequested' },
  { id: 'spirits.country-of-origin', applies: { source: 'imported' }, doesNotApply: { source: 'domestic' }, missing: {}, missingFact: 'source' },
  { id: 'spirits.specialty-composition', applies: { formulaCompositionStatement: 'WHISKY WITH NATURAL FLAVORS' }, doesNotApply: { formulaCompositionStatement: '' }, missing: {}, missingFact: 'formulaCompositionStatement' },
  { id: 'spirits.significant-solids-alcohol', applies: { containsSignificantSolids: true }, doesNotApply: { containsSignificantSolids: false }, missing: {}, missingFact: 'containsSignificantSolids' },
  { id: 'spirits.neutral-spirits-commodity', applies: { containsNeutralSpirits: true }, doesNotApply: { containsNeutralSpirits: false }, missing: {}, missingFact: 'containsNeutralSpirits' },
  { id: 'spirits.age-statement', applies: { requiresAgeStatement: true }, doesNotApply: { requiresAgeStatement: false, spiritsAgeOrMaturityClaim: false }, missing: { requiresAgeStatement: false }, missingFact: 'spiritsAgeOrMaturityClaim' },
  { id: 'spirits.wood-treatment', applies: { requiresWoodTreatmentDisclosure: true }, doesNotApply: { requiresWoodTreatmentDisclosure: false }, missing: {}, missingFact: 'requiresWoodTreatmentDisclosure' },
  { id: 'spirits.state-of-distillation', applies: { requiresStateOfDistillation: true }, doesNotApply: { requiresStateOfDistillation: false }, missing: {}, missingFact: 'requiresStateOfDistillation' },
  { id: 'spirits.yellow-5', applies: { containsYellow5: true }, doesNotApply: { containsYellow5: false }, missing: {}, missingFact: 'containsYellow5' },
  { id: 'spirits.cochineal-carmine', applies: { containsCochinealOrCarmine: true }, doesNotApply: { containsCochinealOrCarmine: false }, missing: {}, missingFact: 'containsCochinealOrCarmine' },
  { id: 'spirits.sulfites', applies: { sulfitesPpm: 10 }, doesNotApply: { sulfitesPpm: 9.9 }, missing: {}, missingFact: 'sulfitesPpm' },
  { id: 'spirits.aspartame', applies: { containsAspartame: true }, doesNotApply: { containsAspartame: false }, missing: {}, missingFact: 'containsAspartame' },
]

describe('distilled-spirits conditional rule coverage', () => {
  it.each(conditionalBranches)('$id resolves all three applicability states', ({ id, applies, doesNotApply, missing, missingFact }) => {
    expect(evaluateRuleApplicability(rule(id), applies).status).toBe('applies')
    expect(evaluateRuleApplicability(rule(id), doesNotApply).status).toBe('does_not_apply')
    expect(evaluateRuleApplicability(rule(id), missing)).toMatchObject({
      status: 'missing_context',
      missingFacts: expect.arrayContaining([missingFact]),
    })
  })

  it('keeps the domestic-only State rule out of the imported rule set', () => {
    const imported = evaluateRuleSet('distilled-spirits-imported', {})!
    const ids = imported.rules.map(({ rule: specification }) => specification.id)
    expect(ids).toContain('spirits.country-of-origin')
    expect(ids).not.toContain('spirits.state-of-distillation')
    expect(ids).not.toContain('common.exemption-state-limitation')
  })

  it('includes State-of-distillation and exemption routing in the domestic rule set', () => {
    const domestic = evaluateRuleSet('distilled-spirits-domestic', {})!
    const ids = domestic.rules.map(({ rule: specification }) => specification.id)
    expect(ids).toContain('spirits.state-of-distillation')
    expect(ids).toContain('common.exemption-state-limitation')
    expect(ids).not.toContain('spirits.country-of-origin')
  })
})
