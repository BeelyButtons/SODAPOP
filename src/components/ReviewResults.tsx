import { useState } from 'react'
import type { CheckStatus, ReviewCheck, ReviewOutcome } from '../domain/reviewSchema'

const statusLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  mismatch: 'Mismatch',
  needs_review: 'Human review',
}

type StaffDecision = 'pass' | 'fail'
type StaffDecisions = Partial<Record<ReviewCheck['id'], StaffDecision>>

type Props = {
  result: ReviewOutcome
  previewUrl: string
  fileName: string
}

function CheckCard({
  check,
  active,
  decision,
  onDecision,
  onPreview,
  onSelect,
}: {
  check: ReviewCheck
  active: boolean
  decision?: StaffDecision
  onDecision: (id: ReviewCheck['id'], decision: StaffDecision) => void
  onPreview: (id: ReviewCheck['id'] | null) => void
  onSelect: (id: ReviewCheck['id']) => void
}) {
  const interactive = Boolean(check.highlight)

  return (
    <article
      className={`check-card check-status-${check.status}${interactive ? ' check-card-highlightable' : ''}${active ? ' check-card-active' : ''}`}
      aria-label={`${check.label} automated finding`}
      onMouseEnter={() => interactive && onPreview(check.id)}
      onMouseLeave={() => interactive && onPreview(null)}
    >
      <div className="check-header">
        <div>
          <span className={`status-icon status-${check.status}`} aria-hidden="true">
            {check.status === 'pass' ? '✓' : check.status === 'mismatch' ? '×' : '?'}
          </span>
          <h3>{check.label}</h3>
        </div>
        <span className={`status-badge status-${check.status}`}>{statusLabels[check.status]}</span>
      </div>
      {interactive && (
        <button
          className="highlight-trigger"
          type="button"
          aria-pressed={active}
          onClick={() => onSelect(check.id)}
          onFocus={() => onPreview(check.id)}
          onBlur={() => onPreview(null)}
        >
          Locate detected area on label
        </button>
      )}
      <p className="check-explanation">{check.explanation}</p>
      <div className="evidence-grid">
        <div><span>Application / requirement</span><p>{check.expected}</p></div>
        <div><span>Observed on label</span><p>{check.observed}</p></div>
      </div>
      <fieldset className="staff-decision">
        <legend>Staff determination</legend>
        <p>After reviewing the evidence, confirm whether this item passes or fails.</p>
        <div>
          <button
            className={decision === 'pass' ? 'decision-button decision-pass selected' : 'decision-button decision-pass'}
            type="button"
            aria-pressed={decision === 'pass'}
            onClick={() => onDecision(check.id, 'pass')}
          >
            Pass
          </button>
          <button
            className={decision === 'fail' ? 'decision-button decision-fail selected' : 'decision-button decision-fail'}
            type="button"
            aria-pressed={decision === 'fail'}
            onClick={() => onDecision(check.id, 'fail')}
          >
            Fail
          </button>
        </div>
      </fieldset>
    </article>
  )
}

export function ReviewResults({ result, previewUrl, fileName }: Props) {
  const [previewedCheck, setPreviewedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [selectedCheck, setSelectedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [staffDecisions, setStaffDecisions] = useState<StaffDecisions>({})
  const [submitted, setSubmitted] = useState(false)
  const passed = result.checks.filter((check) => check.status === 'pass').length
  const mismatches = result.checks.filter((check) => check.status === 'mismatch').length
  const reviews = result.checks.filter((check) => check.status === 'needs_review').length
  const underTarget = result.durationMs <= 5000
  const activeCheckId = previewedCheck ?? selectedCheck
  const activeCheck = result.checks.find((check) => check.id === activeCheckId)
  const highlight = activeCheck?.highlight
  const highlightStatus = activeCheck?.status
  const highlightLabel =
    highlightStatus === 'pass'
      ? 'Matched text'
      : highlightStatus === 'mismatch'
        ? 'Confirmed issue'
        : 'Human review area'
  const decidedCount = result.checks.filter((check) => staffDecisions[check.id]).length
  const allDecided = decidedCount === result.checks.length
  const finalDecision = allDecided
    ? result.checks.some((check) => staffDecisions[check.id] === 'fail')
      ? 'fail'
      : 'pass'
    : null

  function selectCheck(id: ReviewCheck['id']) {
    setSelectedCheck((current) => (current === id ? null : id))
  }

  function recordDecision(id: ReviewCheck['id'], decision: StaffDecision) {
    setStaffDecisions((current) => ({ ...current, [id]: decision }))
    setSubmitted(false)
  }

  return (
    <section className="results-section" aria-labelledby="results-title">
      <div className={`result-summary summary-${result.status}`}>
        <div className="summary-icon" aria-hidden="true">
          {result.status === 'mismatch' ? '!' : result.status === 'needs_review' ? '?' : '✓'}
        </div>
        <div>
          <p className="eyebrow">Automated review complete</p>
          <h2 id="results-title">
            {result.status === 'mismatch'
              ? `${mismatches} ${mismatches === 1 ? 'discrepancy' : 'discrepancies'} found`
              : result.status === 'needs_review'
                ? 'Content checked; human review remains'
                : 'All automated checks passed'}
          </h2>
          <p>{passed} passed · {reviews} need human review · {mismatches} mismatched</p>
        </div>
        <div className="metrics">
          <div><strong>{Math.round(result.ocrConfidence)}%</strong><span>OCR confidence</span></div>
          <div className={underTarget ? 'metric-good' : 'metric-slow'}>
            <strong>{(result.durationMs / 1000).toFixed(1)}s</strong>
            <span>{underTarget ? 'Within target' : 'Above 5s target'}</span>
          </div>
        </div>
      </div>

      <div className="review-instruction">
        <span className="step-number">2</span>
        <div>
          <h2>Make the staff determination</h2>
          <p>Review every automated finding and mark each item Pass or Fail. Automated findings are evidence, not the final decision.</p>
        </div>
        <strong>{decidedCount} of {result.checks.length} decided</strong>
      </div>

      <div className="results-comparison">
        <figure className="results-preview" aria-label="Label artwork with OCR highlight">
          <div className="results-preview-heading">
            <div>
              <span>Label artwork</span>
              <strong>{highlight ? activeCheck?.label : 'Select a highlighted result'}</strong>
            </div>
            {highlight && (
              <span className={`highlight-key highlight-${highlightStatus}`}>
                <i /> {highlightLabel}
              </span>
            )}
          </div>
          <div className="results-preview-frame" id="results-label-preview">
            <img src={previewUrl} alt="Alcohol label used for this review" />
            {highlight?.boxes.map((box, index) => (
              <span
                className={`ocr-highlight-box highlight-${highlightStatus}`}
                aria-hidden="true"
                key={`${box.x0}-${box.y0}-${index}`}
                style={{
                  left: `${(box.x0 / highlight.imageWidth) * 100}%`,
                  top: `${(box.y0 / highlight.imageHeight) * 100}%`,
                  width: `${((box.x1 - box.x0) / highlight.imageWidth) * 100}%`,
                  height: `${((box.y1 - box.y0) / highlight.imageHeight) * 100}%`,
                }}
              />
            ))}
          </div>
          <figcaption title={fileName}>{fileName}</figcaption>
        </figure>

        <div>
          <div className="check-list">
            {result.checks.map((check) => (
              <CheckCard
                check={check}
                active={activeCheckId === check.id}
                decision={staffDecisions[check.id]}
                key={check.id}
                onDecision={recordDecision}
                onPreview={setPreviewedCheck}
                onSelect={selectCheck}
              />
            ))}
          </div>

          <details className="ocr-details">
            <summary>View raw OCR text</summary>
            <pre>{result.ocrText || 'No text was extracted.'}</pre>
          </details>
        </div>
      </div>

      <section className={`final-decision-panel${finalDecision ? ` final-${finalDecision}` : ''}`} aria-labelledby="final-decision-title">
        <div className="final-decision-copy">
          <span className="step-number">3</span>
          <div>
            <p className="eyebrow">Final staff decision</p>
            <h2 id="final-decision-title">
              {!finalDecision
                ? 'Complete every item to determine the result'
                : finalDecision === 'pass'
                  ? 'Final determination: Pass'
                  : 'Final determination: Fail'}
            </h2>
            <p>
              {!finalDecision
                ? `${result.checks.length - decidedCount} item${result.checks.length - decidedCount === 1 ? '' : 's'} still require a staff determination.`
                : finalDecision === 'pass'
                  ? 'All reviewed items are marked Pass.'
                  : 'At least one reviewed item is marked Fail, so the label cannot pass.'}
            </p>
          </div>
        </div>
        <button
          className="primary-button final-submit-button"
          type="button"
          disabled={!allDecided || submitted}
          onClick={() => setSubmitted(true)}
        >
          {submitted ? 'Final decision submitted' : 'Submit final decision'}
          {!submitted && <span aria-hidden="true">→</span>}
        </button>
        {submitted && (
          <p className="submission-confirmation" role="status">
            Final {finalDecision === 'pass' ? 'Pass' : 'Fail'} decision recorded for this browser session.
          </p>
        )}
      </section>
    </section>
  )
}
