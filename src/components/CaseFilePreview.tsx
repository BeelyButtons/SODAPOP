import { useMemo, useState } from 'react'
import { SAMPLE_REVIEW_CASES } from '../data/sampleReviewCases'
import {
  evaluatePacketReadiness,
  resolveClaimEvidence,
  type PacketReadiness,
  type ReviewCaseFile,
} from '../domain/reviewCaseFile'

type Props = {
  onBack: () => void
}

const productLabels: Record<ReviewCaseFile['application']['productType'], string> = {
  distilled_spirits: 'Distilled spirits',
  wine: 'Wine',
  malt_beverage: 'Malt beverage',
}

const readinessCopy: Record<PacketReadiness['status'], {
  label: string
  heading: string
  explanation: string
  action: string
}> = {
  cannot_review: {
    label: 'Cannot start review',
    heading: 'The case file is incomplete',
    explanation: 'A required part of the case is missing, so the label review should not begin yet.',
    action: 'Obtain the missing case material before examining label compliance.',
  },
  needs_correction: {
    label: 'Needs correction',
    heading: 'The application conflicts with official records',
    explanation: 'The disagreement is established by case-file evidence. This is not an image-reading problem.',
    action: 'Return the application and label for correction. Do not ask the reviewer to resolve this through OCR.',
  },
  needs_evidence: {
    label: 'Needs evidence',
    heading: 'A label claim has not been supported',
    explanation: 'The applicant made the claim, but the case file does not contain qualifying evidence for it.',
    action: 'Request substantiation or revise the claim before deciding whether the label complies.',
  },
  ready_for_label_review: {
    label: 'Ready for label review',
    heading: 'The case file is ready',
    explanation: 'The packet is complete enough to examine the label against the applicable requirements.',
    action: 'Continue to label wording, placement, legibility, and prohibited-practice review. This is not an approval.',
  },
}

function statusLabel(status: 'ready' | 'problem' | 'missing') {
  if (status === 'ready') return 'Ready'
  if (status === 'problem') return 'Conflict'
  return 'Needed'
}

function caseSections(caseFile: ReviewCaseFile) {
  const claimResolutions = caseFile.claims.map((claim) => resolveClaimEvidence(caseFile, claim))
  const labelsComplete = caseFile.labelPackage.panels.length > 0 && caseFile.labelPackage.panels.every((panel) => panel.present)
    && (!caseFile.labelPackage.translationsRequired || caseFile.labelPackage.translationsProvided)
    && (!caseFile.labelPackage.containerEvidenceRequired || caseFile.labelPackage.containerEvidenceProvided)
  const claimsConflict = claimResolutions.some((resolution) => resolution.status === 'contradicted')
  const claimsMissing = claimResolutions.some((resolution) => resolution.status === 'missing')

  return [
    {
      label: 'Applicant authorization',
      status: caseFile.applicantAuthorization.status === 'verified' ? 'ready' as const : caseFile.applicantAuthorization.status === 'conflict' ? 'problem' as const : 'missing' as const,
      detail: caseFile.applicantAuthorization.explanation,
    },
    {
      label: 'Product identity',
      status: ['approved', 'not_required'].includes(caseFile.productDetermination.status) ? 'ready' as const : caseFile.productDetermination.status === 'conflict' ? 'problem' as const : 'missing' as const,
      detail: caseFile.productDetermination.explanation,
    },
    {
      label: 'Claim evidence',
      status: claimsConflict ? 'problem' as const : claimsMissing ? 'missing' as const : 'ready' as const,
      detail: !caseFile.claims.length
        ? 'No claim-specific evidence is required in this synthetic case.'
        : claimsConflict
          ? 'Qualifying evidence contradicts at least one claim.'
          : claimsMissing
            ? 'At least one claim has only an applicant statement or inconclusive material.'
            : 'Qualifying evidence supports the claims in this case.',
    },
    {
      label: 'Label package',
      status: labelsComplete ? 'ready' as const : 'missing' as const,
      detail: labelsComplete
        ? `${caseFile.labelPackage.panels.length} submitted label ${caseFile.labelPackage.panels.length === 1 ? 'item is' : 'items are'} present${caseFile.labelPackage.translationsRequired ? ', with translations' : ''}.`
        : 'A required label item, translation, or container record is missing.',
    },
  ]
}

function authorityLabel(authority: ReviewCaseFile['evidence'][number]['authority']) {
  if (authority === 'authoritative_determination') return 'Official determination'
  if (authority === 'supporting_record') return 'Supporting record'
  return 'Applicant statement'
}

export function CaseFilePreview({ onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string>(SAMPLE_REVIEW_CASES[0].caseId)
  const caseFile = SAMPLE_REVIEW_CASES.find((candidate) => candidate.caseId === selectedId) as ReviewCaseFile
  const readiness = useMemo(() => evaluatePacketReadiness(caseFile), [caseFile])
  const copy = readinessCopy[readiness.status]
  const sections = caseSections(caseFile)
  const supportingConclusions = caseFile.evidence
    .filter((record) => record.authority !== 'applicant_assertion' && record.assessment === 'supports')
    .map((record) => record.summary)
  const caseRecordConclusion = caseFile.productDetermination.classType
    ? [caseFile.productDetermination.classType, caseFile.productDetermination.compositionStatement].filter(Boolean).join(' — ')
    : supportingConclusions.length
      ? supportingConclusions.join(' ')
      : caseFile.claims.some((claim) => resolveClaimEvidence(caseFile, claim).status === 'missing')
        ? 'No qualifying record supports this claim.'
        : caseFile.productDetermination.explanation
  const caseRecordExplanation = caseFile.productDetermination.classType
    ? caseFile.productDetermination.explanation
    : supportingConclusions.length
      ? 'These supporting records can be evaluated separately from the applicant’s statements.'
      : caseFile.claims.some((claim) => resolveClaimEvidence(caseFile, claim).status === 'missing')
        ? 'The application statement alone cannot substantiate the claim.'
        : caseFile.productDetermination.explanation

  return (
    <section className="case-file-preview" aria-labelledby="case-preview-title">
      <header className="case-preview-heading">
        <div>
          <p className="eyebrow">Separate preview · No current reviews changed</p>
          <h1 id="case-preview-title">Document-aware case review</h1>
          <p>Choose a simple example to see how application claims, official records, and label evidence are kept separate.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>← Review queue</button>
      </header>

      <nav className="case-example-picker" aria-label="Synthetic case examples">
        {SAMPLE_REVIEW_CASES.map((candidate) => {
          const candidateReadiness = evaluatePacketReadiness(candidate as ReviewCaseFile)
          return (
            <button
              type="button"
              className={candidate.caseId === selectedId ? 'selected' : ''}
              aria-pressed={candidate.caseId === selectedId}
              onClick={() => setSelectedId(candidate.caseId)}
              key={candidate.caseId}
            >
              <span>{productLabels[candidate.application.productType]}</span>
              <strong>{candidate.title}</strong>
              <small>{readinessCopy[candidateReadiness.status].label}</small>
            </button>
          )
        })}
      </nav>

      <article className={`case-primary-task case-primary-${readiness.status}`} aria-live="polite">
        <p>{copy.label}</p>
        <h2>{copy.heading}</h2>
        <p>{copy.explanation}</p>
        <div><strong>Reviewer’s next step</strong><span>{copy.action}</span></div>
      </article>

      <section className="case-fact-comparison" aria-labelledby="case-comparison-title">
        <div className="case-section-heading">
          <p className="eyebrow">The important comparison</p>
          <h2 id="case-comparison-title">What does each source say?</h2>
        </div>
        <div>
          <article>
            <span>Application says</span>
            <strong>{caseFile.application.classType}</strong>
            <p>This is what the applicant entered. It is a claim, not proof.</p>
          </article>
          <article>
            <span>Case records say</span>
            <strong>{caseRecordConclusion}</strong>
            <p>{caseRecordExplanation}</p>
          </article>
        </div>
      </section>

      <section className="case-packet-summary" aria-labelledby="packet-summary-title">
        <div className="case-section-heading">
          <p className="eyebrow">Case-file check</p>
          <h2 id="packet-summary-title">Is the reviewer’s packet ready?</h2>
        </div>
        <div className="case-packet-rows">
          {sections.map((section) => (
            <div className={`case-packet-row case-packet-${section.status}`} key={section.label}>
              <span aria-hidden="true">{section.status === 'ready' ? '✓' : section.status === 'problem' ? '!' : '—'}</span>
              <strong>{section.label}</strong>
              <p>{section.detail}</p>
              <em>{statusLabel(section.status)}</em>
            </div>
          ))}
        </div>
      </section>

      <details className="case-evidence-details">
        <summary>See the records behind this result ({caseFile.evidence.length})</summary>
        <div>
          {caseFile.evidence.map((record) => (
            <article key={record.id}>
              <span>{authorityLabel(record.authority)}</span>
              <h3>{record.title}</h3>
              <p>{record.summary}</p>
              {record.reference && <small>Reference: {record.reference}</small>}
            </article>
          ))}
        </div>
      </details>

      <p className="case-preview-boundary">Synthetic training information only. “Ready for label review” means the packet is sufficient to begin—not that the label is approved.</p>
    </section>
  )
}
