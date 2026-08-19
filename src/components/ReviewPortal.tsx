import { SAMPLE_LABELS } from '../data/sampleLabels'
import type { QueueProgress } from '../reviewQueue'

type Props = {
  progress: QueueProgress
  onStart: () => void
  onSelect: (id: (typeof SAMPLE_LABELS)[number]['id']) => void
  onReset: () => void
}

export function ReviewPortal({ progress, onStart, onSelect, onReset }: Props) {
  const completed = SAMPLE_LABELS.filter((sample) => progress[sample.id]).length
  const remaining = SAMPLE_LABELS.length - completed

  return (
    <section className="queue-portal" aria-labelledby="queue-title">
      <div className="queue-hero">
        <div>
          <p className="eyebrow">Review portal</p>
          <h1 id="queue-title">Labels to Review</h1>
          <p>Work through the demonstration queue one label at a time. Your progress stays in this browser.</p>
        </div>
        <div className="queue-summary" aria-label={`${remaining} labels remaining and ${completed} completed`}>
          <div><strong>{remaining}</strong><span>Remaining</span></div>
          <div><strong>{completed}</strong><span>Completed</span></div>
        </div>
      </div>

      <div className="queue-actions">
        <button className="primary-button" type="button" disabled={remaining === 0} onClick={onStart}>
          Start / Restart label reviews <span aria-hidden="true">→</span>
        </button>
        {completed > 0 && (
          <button className="secondary-button" type="button" onClick={onReset}>Reset review queue</button>
        )}
      </div>

      {remaining === 0 && (
        <div className="queue-complete" role="status">
          <span aria-hidden="true">✓</span>
          <div><h2>No reviews remaining</h2><p>Every demonstration label has a final staff decision.</p></div>
        </div>
      )}

      <ol className="queue-list">
        {SAMPLE_LABELS.map((sample, index) => {
          const decision = progress[sample.id]
          return (
            <li key={sample.id} className={decision ? `queue-item queue-${decision}` : 'queue-item'}>
              <button type="button" onClick={() => onSelect(sample.id)}>
                <span className="queue-number">{index + 1}</span>
                <span className="queue-copy"><strong>{sample.name}</strong><small>{sample.description}</small></span>
                <span className="queue-status">
                  {decision ? (decision === 'pass' ? 'Passed' : 'Failed') : 'To review'}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
