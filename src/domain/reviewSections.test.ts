import { describe, expect, it } from 'vitest'
import type { ReviewCheck } from './reviewSchema'
import { buildReviewSections, sectionIdForCheck } from './reviewSections'

function check(id: string, status: ReviewCheck['status'] = 'pass'): ReviewCheck {
  return { id, ruleId: id, label: id, status, expected: '', observed: '', explanation: '' }
}

describe('shared review sections', () => {
  it('always returns the same seven sections in the same order', () => {
    const sections = buildReviewSections([])
    expect(sections.map((section) => section.id)).toEqual([
      'application',
      'identity',
      'alcohol_quantity',
      'responsible_party_origin',
      'government_warning',
      'formula_disclosures',
      'other_claims',
    ])
    expect(sections.every((section) => section.status === 'not_applicable')).toBe(true)
  })

  it('uses the strongest child status for a section', () => {
    const sections = buildReviewSections([
      check('malt.brand-name'),
      check('malt.class-type-designation', 'needs_review'),
      check('malt.geographic-designation', 'mismatch'),
    ])
    expect(sections.find((section) => section.id === 'identity')).toMatchObject({
      status: 'mismatch',
      counts: { mismatch: 1, needs_review: 1, pass: 1 },
    })
  })

  it('groups equivalent spirits, wine, and malt checks into shared sections', () => {
    expect(sectionIdForCheck(check('spirits.brand-name'))).toBe('identity')
    expect(sectionIdForCheck(check('wine.appellation'))).toBe('identity')
    expect(sectionIdForCheck(check('malt.class-type-designation'))).toBe('identity')
    expect(sectionIdForCheck(check('spirits.name-address'))).toBe('responsible_party_origin')
    expect(sectionIdForCheck(check('wine.country-of-origin'))).toBe('responsible_party_origin')
    expect(sectionIdForCheck(check('malt.import-bottling-disposition'))).toBe('responsible_party_origin')
    expect(sectionIdForCheck(check('common.health-warning-format'))).toBe('government_warning')
    expect(sectionIdForCheck(check('malt.sulfites'))).toBe('formula_disclosures')
  })
})
