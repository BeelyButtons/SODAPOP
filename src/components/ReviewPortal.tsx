import { useState } from 'react'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import { currentReviewForSample, type QueueProgress } from '../reviewQueue'

type Props = {
  progress: QueueProgress
  onStart: () => void
  onSelect: (id: (typeof SAMPLE_LABELS)[number]['id']) => void
  onCompleted: () => void
  onReset: () => void
}

export function ReviewPortal({ progress, onStart, onSelect, onCompleted, onReset }: Props) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const remainingSamples = SAMPLE_LABELS.filter((sample) => !currentReviewForSample(progress, sample.id))
  const completed = SAMPLE_LABELS.length - remainingSamples.length

  return (
    <section className="queue-portal" aria-labelledby="queue-title">
      <div className="queue-hero">
        <div>
          <p className="eyebrow">Review portal</p>
          <h1 id="queue-title">Labels to Review</h1>
          <p>Work through the remaining demonstration labels one at a time.</p>
        </div>
        <div className="queue-summary-cluster">
          <div className="queue-summary queue-summary-remaining" aria-label={`${remainingSamples.length} labels remaining`}>
            <div><strong>{remainingSamples.length}</strong><span>Remaining</span></div>
          </div>
          {completed > 0 && <button className="text-button" type="button" onClick={() => setConfirmingReset(true)}>Reset review queue</button>}
        </div>
      </div>

      <div className="queue-actions">
        <button className="primary-button" type="button" disabled={remainingSamples.length === 0} onClick={onStart}>
          Start / Restart label reviews <span aria-hidden="true">→</span>
        </button>
        {completed > 0 && (
          <button className="secondary-button" type="button" onClick={onCompleted}>View completed label review decisions</button>
        )}
      </div>

      {remainingSamples.length === 0 && (
        <div className="queue-complete" role="status">
          <span aria-hidden="true">✓</span>
          <div><h2>No reviews remaining</h2><p>Every demonstration label has a final staff decision.</p></div>
        </div>
      )}

      <ol className="queue-list">
        {remainingSamples.map((sample, index) => (
            <li key={sample.id} className="queue-item">
              <button type="button" onClick={() => onSelect(sample.id)}>
                <span className="queue-number">{index + 1}</span>
                <span className="queue-copy"><strong>{sample.name}</strong><small>{sample.description}</small></span>
                <span className="queue-status">To review</span>
              </button>
            </li>
        ))}
      </ol>

      {confirmingReset && (
        <div className="quick-fail-backdrop" role="presentation">
          <section className="quick-fail-dialog reset-queue-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-dialog-title">
            <span className="quick-fail-icon" aria-hidden="true">!</span>
            <p className="eyebrow">Reset saved work</p>
            <h2 id="reset-dialog-title">Reset the entire review queue?</h2>
            <p>This permanently clears every completed decision and revision saved in this browser.</p>
            <div>
              <button className="secondary-button" type="button" onClick={() => setConfirmingReset(false)}>Keep saved reviews</button>
              <button className="confirm-fail-button" type="button" onClick={() => { setConfirmingReset(false); onReset() }} autoFocus>Reset review queue</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
