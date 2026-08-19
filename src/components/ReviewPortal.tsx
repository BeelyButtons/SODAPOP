import { SAMPLE_LABELS } from '../data/sampleLabels'
import type { QueueProgress } from '../reviewQueue'

type Props = {
  progress: QueueProgress
  onStart: () => void
  onSelect: (id: (typeof SAMPLE_LABELS)[number]['id']) => void
  onCompleted: () => void
  onReset: () => void
}

export function ReviewPortal({ progress, onStart, onSelect, onCompleted, onReset }: Props) {
  const remainingSamples = SAMPLE_LABELS.filter((sample) => !progress[sample.id])
  const completed = SAMPLE_LABELS.length - remainingSamples.length

  return (
    <section className="queue-portal" aria-labelledby="queue-title">
      <div className="queue-hero">
        <div>
          <p className="eyebrow">Review portal</p>
          <h1 id="queue-title">Labels to Review</h1>
          <p>Work through the remaining demonstration labels one at a time.</p>
        </div>
        <div className="queue-summary queue-summary-remaining" aria-label={`${remainingSamples.length} labels remaining`}>
          <div><strong>{remainingSamples.length}</strong><span>Remaining</span></div>
        </div>
      </div>

      <div className="queue-actions">
        <button className="primary-button" type="button" disabled={remainingSamples.length === 0} onClick={onStart}>
          Start / Restart label reviews <span aria-hidden="true">→</span>
        </button>
        {completed > 0 && (
          <button className="secondary-button" type="button" onClick={onCompleted}>View completed label review decisions</button>
        )}
        {completed > 0 && <button className="text-button" type="button" onClick={onReset}>Reset review queue</button>}
      </div>

      {remainingSamples.length === 0 && (
        <div className="queue-complete" role="status">
          <span aria-hidden="true">✓</span>
          <div><h2>No reviews remaining</h2><p>Every demonstration label has a final staff decision.</p></div>
        </div>
      )}

      <ol className="queue-list">
        {remainingSamples.map((sample) => {
          const originalIndex = SAMPLE_LABELS.findIndex((candidate) => candidate.id === sample.id)
          return (
            <li key={sample.id} className="queue-item">
              <button type="button" onClick={() => onSelect(sample.id)}>
                <span className="queue-number">{originalIndex + 1}</span>
                <span className="queue-copy"><strong>{sample.name}</strong><small>{sample.description}</small></span>
                <span className="queue-status">To review</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
