import type { CheckStatus, ReviewOutcome } from '../domain/reviewSchema'

const statusLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  mismatch: 'Mismatch',
  needs_review: 'Human review',
}

export function ReviewResults({ result }: { result: ReviewOutcome }) {
  const passed = result.checks.filter((check) => check.status === 'pass').length
  const mismatches = result.checks.filter((check) => check.status === 'mismatch').length
  const reviews = result.checks.filter((check) => check.status === 'needs_review').length
  const underTarget = result.durationMs <= 5000

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
              ? `${mismatches} discrepancy${mismatches === 1 ? '' : 'ies'} found`
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

      <div className="check-list">
        {result.checks.map((check) => (
          <article className="check-card" key={check.id}>
            <div className="check-header">
              <div>
                <span className={`status-icon status-${check.status}`} aria-hidden="true">
                  {check.status === 'pass' ? '✓' : check.status === 'mismatch' ? '×' : '?'}
                </span>
                <h3>{check.label}</h3>
              </div>
              <span className={`status-badge status-${check.status}`}>{statusLabels[check.status]}</span>
            </div>
            <p className="check-explanation">{check.explanation}</p>
            <div className="evidence-grid">
              <div><span>Application / requirement</span><p>{check.expected}</p></div>
              <div><span>Observed on label</span><p>{check.observed}</p></div>
            </div>
          </article>
        ))}
      </div>

      <details className="ocr-details">
        <summary>View raw OCR text</summary>
        <pre>{result.ocrText || 'No text was extracted.'}</pre>
      </details>
    </section>
  )
}
