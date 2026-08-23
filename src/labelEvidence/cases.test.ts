import { describe, expect, it } from 'vitest'
import { LABEL_EVIDENCE_CASES, ROUTING_CATEGORIES } from './cases'
import { selectBalancedCases } from './batch'

describe('LabelEvidence demonstration cases', () => {
  it('contains seven cases in each of eight routing categories', () => {
    expect(LABEL_EVIDENCE_CASES).toHaveLength(56)
    expect(ROUTING_CATEGORIES).toHaveLength(8)
    for (const category of ROUTING_CATEGORIES) {
      expect(LABEL_EVIDENCE_CASES.filter((item) => item.category.id === category.id)).toHaveLength(7)
    }
  })

  it('does not expose an intended pass or fail result to the runtime case', () => {
    for (const item of LABEL_EVIDENCE_CASES) {
      expect(item).not.toHaveProperty('expectedResult')
      expect(item).not.toHaveProperty('shouldPass')
      expect(item.application).not.toHaveProperty('expectedResult')
      expect(item.label).not.toHaveProperty('expectedResult')
    }
  })

})

describe('balanced batch selection', () => {
  it('selects 40 unique cases with five from every routing category', () => {
    const selected = selectBalancedCases(20260822)
    expect(selected).toHaveLength(40)
    expect(new Set(selected.map((item) => item.id)).size).toBe(40)
    for (const category of ROUTING_CATEGORIES) {
      expect(selected.filter((item) => item.category.id === category.id)).toHaveLength(5)
    }
  })

  it('is repeatable for a saved batch seed', () => {
    expect(selectBalancedCases(17).map((item) => item.id)).toEqual(selectBalancedCases(17).map((item) => item.id))
  })
})
