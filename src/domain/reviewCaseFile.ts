import { z } from 'zod'
import { applicationSchema } from './reviewSchema'

export const evidenceAuthoritySchema = z.enum([
  'applicant_assertion',
  'supporting_record',
  'authoritative_determination',
])

export const evidenceRecordSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum([
    'application_statement',
    'permit_record',
    'approved_formula',
    'ttb_lab_result',
    'producer_letter',
    'production_record',
    'organic_certifier_approval',
    'age_origin_certificate',
    'natural_wine_certificate',
    'analytical_report',
    'label_artwork',
    'container_evidence',
    'prior_cola',
    'other',
  ]),
  title: z.string().trim().min(1),
  authority: evidenceAuthoritySchema,
  assessment: z.enum(['supports', 'contradicts', 'inconclusive']),
  reference: z.string().trim().optional(),
  issuer: z.string().trim().optional(),
  summary: z.string().trim().min(1),
})

export const reviewClaimSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum([
    'identity',
    'composition',
    'age',
    'origin',
    'organic',
    'wine_appellation',
    'wine_varietal',
    'wine_vintage',
    'estate_bottled',
    'production_method',
    'ingredient',
    'gluten',
    'nutrient',
    'award_or_certification',
    'other',
  ]),
  statement: z.string().trim().min(1),
  evidenceRequired: z.boolean(),
  evidenceIds: z.array(z.string().trim().min(1)),
})

export const reviewCaseFileSchema = z.object({
  caseId: z.string().trim().min(1),
  sampleLabelId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  application: applicationSchema,
  applicantAuthorization: z.object({
    status: z.enum(['verified', 'not_verified', 'conflict']),
    recordType: z.enum(['plant_registry', 'basic_permit', 'brewers_notice']),
    recordNumber: z.string().trim().optional(),
    legalName: z.string().trim().optional(),
    address: z.string().trim().optional(),
    approvedTradeNames: z.array(z.string().trim().min(1)).default([]),
    authorizedOperations: z.array(z.string().trim().min(1)).default([]),
    explanation: z.string().trim().min(1),
  }),
  productDetermination: z.object({
    required: z.boolean(),
    status: z.enum(['not_required', 'approved', 'missing', 'conflict']),
    formulaId: z.string().trim().optional(),
    classType: z.string().trim().optional(),
    compositionStatement: z.string().trim().optional(),
    labelingInstructions: z.array(z.string().trim().min(1)).default([]),
    explanation: z.string().trim().min(1),
  }),
  evidence: z.array(evidenceRecordSchema),
  claims: z.array(reviewClaimSchema),
  labelPackage: z.object({
    panels: z.array(z.object({
      id: z.string().trim().min(1),
      role: z.enum(['brand', 'front', 'back', 'side', 'neck', 'closure', 'container_marking', 'other']),
      present: z.boolean(),
      description: z.string().trim().min(1),
    })),
    translationsRequired: z.boolean(),
    translationsProvided: z.boolean(),
    physicalDimensionsKnown: z.boolean(),
    containerCapacityMl: z.number().positive(),
    containerEvidenceRequired: z.boolean(),
    containerEvidenceProvided: z.boolean(),
  }),
  history: z.array(z.object({
    date: z.string().trim().min(1),
    event: z.enum(['created', 'needs_correction', 'resubmitted', 'rejected', 'approved', 'revised']),
    reference: z.string().trim().optional(),
    summary: z.string().trim().min(1),
  })),
})

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>
export type ReviewClaim = z.infer<typeof reviewClaimSchema>
export type ReviewCaseFile = z.infer<typeof reviewCaseFileSchema>

export type ClaimEvidenceResolution = {
  status: 'supported' | 'missing' | 'contradicted' | 'not_required'
  evidence: EvidenceRecord[]
  explanation: string
}

export type PacketReadinessIssue = {
  id: string
  category: 'packet' | 'authorization' | 'product' | 'claim'
  title: string
  explanation: string
}

export type PacketReadiness = {
  status: 'cannot_review' | 'needs_correction' | 'needs_evidence' | 'ready_for_label_review'
  issues: PacketReadinessIssue[]
}

function qualifyingEvidence(record: EvidenceRecord) {
  return record.authority !== 'applicant_assertion'
}

export function resolveClaimEvidence(
  caseFile: ReviewCaseFile,
  claim: ReviewClaim,
): ClaimEvidenceResolution {
  if (!claim.evidenceRequired) {
    return {
      status: 'not_required',
      evidence: [],
      explanation: 'This claim does not require separate substantiation in the case packet.',
    }
  }

  const referenced = claim.evidenceIds
    .map((id) => caseFile.evidence.find((record) => record.id === id))
    .filter((record): record is EvidenceRecord => Boolean(record))
  const qualifying = referenced.filter(qualifyingEvidence)

  if (qualifying.some((record) => record.assessment === 'contradicts')) {
    return {
      status: 'contradicted',
      evidence: referenced,
      explanation: 'Qualifying evidence contradicts the claim.',
    }
  }

  if (qualifying.some((record) => record.assessment === 'supports')) {
    return {
      status: 'supported',
      evidence: referenced,
      explanation: 'Qualifying evidence supports the claim.',
    }
  }

  return {
    status: 'missing',
    evidence: referenced,
    explanation: referenced.length
      ? 'The packet contains only an applicant assertion or inconclusive material; qualifying substantiation is still required.'
      : 'No evidence was supplied for this claim.',
  }
}

export function evaluatePacketReadiness(caseFile: ReviewCaseFile): PacketReadiness {
  const blockingIssues: PacketReadinessIssue[] = []
  const correctionIssues: PacketReadinessIssue[] = []
  const evidenceIssues: PacketReadinessIssue[] = []
  const missingPanels = caseFile.labelPackage.panels.filter((panel) => !panel.present)

  if (!caseFile.labelPackage.panels.length || missingPanels.length) {
    blockingIssues.push({
      id: 'label-package-incomplete',
      category: 'packet',
      title: 'Complete label package required',
      explanation: missingPanels.length
        ? `Missing submitted material: ${missingPanels.map((panel) => panel.description).join(', ')}.`
        : 'No label panels are present in the case file.',
    })
  }

  if (caseFile.labelPackage.translationsRequired && !caseFile.labelPackage.translationsProvided) {
    blockingIssues.push({
      id: 'translations-missing',
      category: 'packet',
      title: 'English translations required',
      explanation: 'Foreign-language label or container text is present without the required translation.',
    })
  }

  if (caseFile.labelPackage.containerEvidenceRequired && !caseFile.labelPackage.containerEvidenceProvided) {
    blockingIssues.push({
      id: 'container-evidence-missing',
      category: 'packet',
      title: 'Container evidence required',
      explanation: 'The requested review depends on physical-container evidence that was not supplied.',
    })
  }

  if (caseFile.applicantAuthorization.status !== 'verified') {
    blockingIssues.push({
      id: 'applicant-authorization',
      category: 'authorization',
      title: caseFile.applicantAuthorization.status === 'conflict'
        ? 'Applicant information conflicts with authorization records'
        : 'Applicant authorization not verified',
      explanation: caseFile.applicantAuthorization.explanation,
    })
  }

  if (caseFile.productDetermination.required && caseFile.productDetermination.status === 'missing') {
    blockingIssues.push({
      id: 'product-determination-missing',
      category: 'product',
      title: 'Required pre-COLA determination missing',
      explanation: caseFile.productDetermination.explanation,
    })
  } else if (caseFile.productDetermination.status === 'conflict') {
    correctionIssues.push({
      id: 'product-determination-conflict',
      category: 'product',
      title: 'Application conflicts with the product determination',
      explanation: caseFile.productDetermination.explanation,
    })
  }

  caseFile.claims.forEach((claim) => {
    const resolution = resolveClaimEvidence(caseFile, claim)
    if (resolution.status === 'contradicted') {
      correctionIssues.push({
        id: `claim-${claim.id}`,
        category: 'claim',
        title: `Claim contradicted: ${claim.statement}`,
        explanation: resolution.explanation,
      })
    } else if (resolution.status === 'missing') {
      evidenceIssues.push({
        id: `claim-${claim.id}`,
        category: 'claim',
        title: `Evidence needed: ${claim.statement}`,
        explanation: resolution.explanation,
      })
    }
  })

  if (blockingIssues.length) return { status: 'cannot_review', issues: blockingIssues }
  if (correctionIssues.length) return { status: 'needs_correction', issues: correctionIssues }
  if (evidenceIssues.length) return { status: 'needs_evidence', issues: evidenceIssues }
  return { status: 'ready_for_label_review', issues: [] }
}
