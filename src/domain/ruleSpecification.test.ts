import { describe, expect, it } from 'vitest'
import {
  APPLICATION_DATA_SPECIFICATIONS,
  REVIEW_FACT_KEYS,
  RULE_SET_SPECIFICATIONS,
  RULE_SPECIFICATIONS,
} from './ruleSpecification'

describe('post-rule-expansion specification', () => {
  it('defines each rule and rule set exactly once', () => {
    const ruleIds = RULE_SPECIFICATIONS.map((rule) => rule.id)
    const ruleSetIds = RULE_SET_SPECIFICATIONS.map((ruleSet) => ruleSet.id)

    expect(new Set(ruleIds).size).toBe(ruleIds.length)
    expect(new Set(ruleSetIds).size).toBe(ruleSetIds.length)
  })

  it('defines application metadata for every review fact', () => {
    expect(Object.keys(APPLICATION_DATA_SPECIFICATIONS).sort()).toEqual(
      [...REVIEW_FACT_KEYS].sort(),
    )

    Object.values(APPLICATION_DATA_SPECIFICATIONS).forEach((fact) => {
      expect(fact.label.length).toBeGreaterThan(0)
      expect(fact.sources.length).toBeGreaterThan(0)
      expect(fact.purpose.length).toBeGreaterThan(0)
    })
  })

  it('gives every rule complete review and missing-context instructions', () => {
    const knownFacts = new Set<string>(REVIEW_FACT_KEYS)

    RULE_SPECIFICATIONS.forEach((rule) => {
      expect(rule.title.length).toBeGreaterThan(0)
      expect(rule.requirement.length).toBeGreaterThan(0)
      expect(rule.authorities.length).toBeGreaterThan(0)
      expect(rule.evidenceSources.length).toBeGreaterThan(0)
      expect(rule.evaluation.length).toBeGreaterThan(0)
      expect(rule.missingContext.length).toBeGreaterThan(0)
      expect(rule.reviewerCard).toBe(true)

      rule.requiredFacts.forEach((fact) => expect(knownFacts.has(fact)).toBe(true))
      const conditions = [
        ...('all' in rule.appliesWhen ? rule.appliesWhen.all : []),
        ...('any' in rule.appliesWhen ? rule.appliesWhen.any : []),
      ]
      conditions.forEach((condition) => expect(knownFacts.has(condition.fact)).toBe(true))
    })
  })

  it('references only defined rules from every rule set', () => {
    const knownRules = new Set(RULE_SPECIFICATIONS.map((rule) => rule.id))

    RULE_SET_SPECIFICATIONS.forEach((ruleSet) => {
      const ruleIds = [...ruleSet.baseRuleIds, ...ruleSet.conditionalRuleIds]
      expect(ruleIds.length).toBeGreaterThan(0)
      expect(new Set(ruleIds).size).toBe(ruleIds.length)
      ruleIds.forEach((ruleId) => expect(knownRules.has(ruleId)).toBe(true))
    })
  })

  it('places every rule in at least one rule set', () => {
    const assignedRules = new Set(
      RULE_SET_SPECIFICATIONS.flatMap((ruleSet) => [
        ...ruleSet.baseRuleIds,
        ...ruleSet.conditionalRuleIds,
      ]),
    )

    RULE_SPECIFICATIONS.forEach((rule) => expect(assignedRules.has(rule.id)).toBe(true))
  })

  it('keeps automatic base selection on fast structured facts', () => {
    const permittedSelectionFacts = new Set(['productType', 'source', 'alcoholContent'])

    RULE_SET_SPECIFICATIONS.forEach((ruleSet) => {
      ruleSet.selectionFacts.forEach((fact) => {
        expect(permittedSelectionFacts.has(fact)).toBe(true)
      })
    })
  })

  it('routes wine below seven percent instead of assigning a Part 4 rule set', () => {
    const route = RULE_SET_SPECIFICATIONS.find(
      (ruleSet) => ruleSet.id === 'wine-under-7-ttb-routing',
    )

    expect(route?.jurisdiction).toBe('ttb_routing_only')
    expect(route?.baseRuleIds).toContain('wine.under-seven-routing')
    expect(route?.baseRuleIds).toContain('common.health-warning-wording')
  })

  it('limits the intrastate exemption statement to eligible domestic rule sets', () => {
    const setsWithStateLimitation = RULE_SET_SPECIFICATIONS
      .filter((ruleSet) =>
        (ruleSet.conditionalRuleIds as readonly string[]).includes(
          'common.exemption-state-limitation',
        ),
      )
      .map((ruleSet) => ruleSet.id)

    expect(setsWithStateLimitation).toEqual([
      'distilled-spirits-domestic',
      'wine-7plus-domestic',
    ])
  })
})
