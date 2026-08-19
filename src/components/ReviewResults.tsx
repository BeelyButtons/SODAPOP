import { useState, type KeyboardEvent } from 'react'
import type { CheckStatus, ReviewCheck, ReviewOutcome } from '../domain/reviewSchema'

const statusLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  mismatch: 'Mismatch',
  needs_review: 'Human review',
}

type Props = {
  result: ReviewOutcome
  previewUrl: string
  fileName: string
}

function CheckCard({
  check,
  active,
  onPreview,
  onSelect,
}: {
  check: ReviewCheck
  active: boolean
  onPreview: (id: ReviewCheck['id'] | null) => void
  onSelect: (id: ReviewCheck['id']) => void
}) {
  const interactive = Boolean(check.highlight)

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onSelect(check.id)
  }

  return (
    <article
      className={`check-card check-status-${check.status}${interactive ? ' check-card-highlightable' : ''}${active ? ' check-card-active' : ''}`}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? 'button' : undefined}
      aria-pressed={interactive ? active : undefined}
      aria-label={interactive ? `${check.label}. Show detected area on label.` : undefined}
      onMouseEnter={() => interactive && onPreview(check.id)}
      onMouseLeave={() => interactive && onPreview(null)}
      onFocus={() => interactive && onPreview(check.id)}
      onBlur={() => interactive && onPreview(null)}
      onClick={() => interactive && onSelect(check.id)}
      onKeyDown={onKeyDown}
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
      {interactive && <p className="highlight-hint">Hover, focus, or select to locate on label</p>}
      <p className="check-explanation">{check.explanation}</p>
      <div className="evidence-grid">
        <div><span>Application / requirement</span><p>{check.expected}</p></div>
        <div><span>Observed on label</span><p>{check.observed}</p></div>
      </div>
    </article>
  )
}

export function ReviewResults({ result, previewUrl, fileName }: Props) {
  const [previewedCheck, setPreviewedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [selectedCheck, setSelectedCheck] = useState<ReviewCheck['id'] | null>(null)
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

  function selectCheck(id: ReviewCheck['id']) {
    setSelectedCheck((current) => (current === id ? null : id))
  }

  return (
    <section className="results-section" aria-labelledby="results-title">
      <div className={`result-summary summary-${result.status}`}>
        <div className="summary-icon" aria-hidden="true">
          {result.status === 'mismatch' ? '!' : result.status === 'needs_review' ? '?' : '✓'}
        </div>
        <div>
          <p className="eyebrow">Review complete</p>
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
                key={check.id}
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
    </section>
  )
}
