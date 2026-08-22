import { describe, expect, it } from 'vitest'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import type { ReviewCheck } from './reviewSchema'
import { verifyLabel } from './verifyLabel'
import { buildReviewSections, isRecognitionOnlyFinding, presentedStatusForCheck, sectionIdForCheck } from './reviewSections'

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
      counts: { mismatch: 1, needs_review: 1, unverified: 0, pass: 1 },
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

  it('does not present a failed text-recognition attempt as a confirmed mismatch', () => {
    const missingStatement = {
      ...check('malt.sulfites', 'mismatch'),
      observed: 'Authorized sulfite declaration not found',
      explanation: 'Readable artwork omitted the required sulfite declaration.',
    }
    expect(isRecognitionOnlyFinding(missingStatement)).toBe(true)
    expect(presentedStatusForCheck(missingStatement)).toBe('unverified')
    expect(buildReviewSections([missingStatement]).find((section) => section.id === 'formula_disclosures')?.status).toBe('unverified')
  })

  it('keeps positively observed conflicts red', () => {
    const conflict = {
      ...check('malt.country-of-origin', 'mismatch'),
      observed: 'PRODUCT OF AUSTRIA',
      explanation: 'The detected country conflicts with Germany.',
    }
    expect(isRecognitionOnlyFinding(conflict)).toBe(false)
    expect(presentedStatusForCheck(conflict)).toBe('mismatch')
  })

  it('keeps missing application evidence separate from recognition uncertainty', () => {
    const missingContext = {
      ...check('common.formula-labeling-instructions', 'needs_review'),
      observed: 'Missing context: approved formula',
      explanation: 'A required approved formula is absent from the review packet.',
    }
    expect(presentedStatusForCheck(missingContext)).toBe('needs_review')
  })

  it('preserves every underlying check across spirits, wine, and malt outcomes', () => {
    for (const sampleId of ['valid', 'wine-domestic-complete', 'malt-domestic-lager']) {
      const application = SAMPLE_LABELS.find((sample) => sample.id === sampleId)!.application
      const outcome = verifyLabel({
        application,
        ocrText: `${application.brandName}\n${application.classType}\n${application.alcoholContent}\n${application.netContents}`,
        ocrConfidence: 85,
        durationMs: 800,
      })
      const sections = buildReviewSections(outcome.checks)
      const groupedIds = sections.flatMap((section) => section.checks.map((item) => item.id)).sort()
      expect(sections).toHaveLength(7)
      expect(groupedIds).toEqual(outcome.checks.map((item) => item.id).sort())
    }
  })
})
