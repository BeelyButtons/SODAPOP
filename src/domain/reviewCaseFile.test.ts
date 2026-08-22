import { describe, expect, it } from 'vitest'
import { SAMPLE_REVIEW_CASES } from '../data/sampleReviewCases'
import {
  evaluatePacketReadiness,
  resolveClaimEvidence,
  reviewCaseFileSchema,
  type ReviewCaseFile,
} from './reviewCaseFile'

function caseById(caseId: string) {
  const caseFile = SAMPLE_REVIEW_CASES.find((candidate) => candidate.caseId === caseId)
  if (!caseFile) throw new Error(`Missing sample case: ${caseId}`)
  return caseFile as ReviewCaseFile
}

describe('reviewCaseFileSchema', () => {
  it('accepts every cross-category synthetic case', () => {
    SAMPLE_REVIEW_CASES.forEach((caseFile) => {
      expect(reviewCaseFileSchema.safeParse(caseFile).success, caseFile.caseId).toBe(true)
    })
  })
})

describe('resolveClaimEvidence', () => {
  it('does not treat an applicant assertion as substantiation', () => {
    const caseFile = caseById('malt-geographic-claim-unsupported')
    const resolution = resolveClaimEvidence(caseFile, caseFile.claims[0])

    expect(resolution.status).toBe('missing')
  })

  it('gives contradictory authoritative evidence priority over an application assertion', () => {
    const caseFile = caseById('spirits-formula-conflict')
    const resolution = resolveClaimEvidence(caseFile, caseFile.claims[0])

    expect(resolution.status).toBe('contradicted')
  })

  it('recognizes qualifying production records that support wine claims', () => {
    const caseFile = caseById('wine-import-packet-complete')

    expect(resolveClaimEvidence(caseFile, caseFile.claims[0]).status).toBe('supported')
    expect(resolveClaimEvidence(caseFile, caseFile.claims[1]).status).toBe('supported')
  })
})

describe('evaluatePacketReadiness', () => {
  it.each([
    ['spirits-formula-conflict', 'needs_correction'],
    ['wine-import-packet-complete', 'ready_for_label_review'],
    ['malt-geographic-claim-unsupported', 'needs_evidence'],
  ] as const)('classifies %s as %s', (caseId, expected) => {
    expect(evaluatePacketReadiness(caseById(caseId)).status).toBe(expected)
  })

  it('blocks review when a required label panel is absent', () => {
    const completeCase = caseById('wine-import-packet-complete')
    const incompleteCase: ReviewCaseFile = {
      ...completeCase,
      labelPackage: {
        ...completeCase.labelPackage,
        panels: completeCase.labelPackage.panels.map((panel, index) => (
          index === 1 ? { ...panel, present: false } : panel
        )),
      },
    }

    expect(evaluatePacketReadiness(incompleteCase)).toMatchObject({
      status: 'cannot_review',
      issues: [{ id: 'label-package-incomplete' }],
    })
  })
})
