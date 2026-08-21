import { describe, expect, it } from 'vitest'
import { INITIAL_APPLICATION } from './reviewSchema'
import { RULE_SPECIFICATIONS } from './ruleSpecification'
import {
  evaluateRuleApplicability,
  overrideRuleSet,
  rankAlternativeRuleSets,
  reviewContextFromApplication,
  selectAutomaticRuleSet,
} from './ruleEngine'

describe('tri-state rule applicability', () => {
  const importedOriginRule = RULE_SPECIFICATIONS.find(
    (rule) => rule.id === 'spirits.country-of-origin',
  )!

  it('returns applies when the condition is satisfied', () => {
    expect(evaluateRuleApplicability(importedOriginRule, { source: 'imported' }).status).toBe('applies')
  })

  it('returns does not apply when the condition is resolved as false', () => {
    expect(evaluateRuleApplicability(importedOriginRule, { source: 'domestic' }).status).toBe('does_not_apply')
  })

  it('returns missing context instead of silently skipping an unresolved rule', () => {
    expect(evaluateRuleApplicability(importedOriginRule, {})).toMatchObject({
      status: 'missing_context',
      missingFacts: ['source'],
    })
  })
})

describe('automatic rule-set routing', () => {
  it('selects domestic distilled spirits for the current prototype packet', () => {
    const context = reviewContextFromApplication(INITIAL_APPLICATION)
    expect(selectAutomaticRuleSet(context, '2026-01-01T00:00:00.000Z')).toMatchObject({
      status: 'selected',
      selectedRuleSetId: 'distilled-spirits-domestic',
      mode: 'automatic',
    })
  })

  it('selects imported wine at or above seven percent', () => {
    const context = reviewContextFromApplication({
      ...INITIAL_APPLICATION,
      productType: 'wine',
      source: 'imported',
      alcoholContent: '13.5% Alc. by Vol.',
    })
    expect(selectAutomaticRuleSet(context).selectedRuleSetId).toBe('wine-7plus-imported')
  })

  it('routes wine below seven percent without selecting a Part 4 rule set', () => {
    const context = reviewContextFromApplication({
      ...INITIAL_APPLICATION,
      productType: 'wine',
      alcoholContent: '6.5% Alc. by Vol.',
    })
    expect(selectAutomaticRuleSet(context).selectedRuleSetId).toBe('wine-under-7-ttb-routing')
  })

  it('reports missing routing context', () => {
    expect(selectAutomaticRuleSet({ productType: 'wine' })).toMatchObject({
      status: 'missing_context',
      missingFacts: ['alcoholContent'],
    })
  })
})

describe('rule-set alternatives and overrides', () => {
  const context = reviewContextFromApplication(INITIAL_APPLICATION)
  const automatic = selectAutomaticRuleSet(context, '2026-01-01T00:00:00.000Z')

  it('ranks the closest alternative first only when requested', () => {
    const alternatives = rankAlternativeRuleSets(context, automatic.selectedRuleSetId)
    expect(alternatives[0].ruleSet.id).toBe('distilled-spirits-imported')
  })

  it('records a reviewer override while preserving the automatic selection', () => {
    const overridden = overrideRuleSet(
      automatic,
      context,
      'malt-beverage-domestic',
      '2026-01-01T00:01:00.000Z',
    )
    expect(overridden).toMatchObject({
      automaticRuleSetId: 'distilled-spirits-domestic',
      selectedRuleSetId: 'malt-beverage-domestic',
      mode: 'reviewer_override',
    })
    expect(overridden.conflicts).toContain('Application product type is distilled spirits.')
    expect(overridden.audit).toHaveLength(2)
  })

  it('returns to automatic mode when the automatic set is restored', () => {
    const overridden = overrideRuleSet(automatic, context, 'malt-beverage-domestic')
    const restored = overrideRuleSet(overridden, context, 'distilled-spirits-domestic')
    expect(restored.mode).toBe('automatic')
  })

  it('keeps routing, applicability, ranking, and override work far below the five-second budget', () => {
    const startedAt = performance.now()
    let selection = automatic

    for (let index = 0; index < 500; index += 1) {
      selection = overrideRuleSet(selection, context, 'distilled-spirits-imported')
      evaluateRuleApplicability(
        RULE_SPECIFICATIONS.find((rule) => rule.id === 'spirits.country-of-origin')!,
        context,
      )
      rankAlternativeRuleSets(context, selection.selectedRuleSetId)
    }

    expect(performance.now() - startedAt).toBeLessThan(5_000)
  })
})
