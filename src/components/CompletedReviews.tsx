import { SAMPLE_LABELS } from '../data/sampleLabels'
import type { QueueProgress } from '../reviewQueue'

type Props = {
  progress: QueueProgress
  onBack: () => void
  onOpen: (id: (typeof SAMPLE_LABELS)[number]['id']) => void
}

export function CompletedReviews({ progress, onBack, onOpen }: Props) {
  const completed = SAMPLE_LABELS.filter((sample) => progress[sample.id])

  return (
    <section className="completed-reviews" aria-labelledby="completed-title">
      <div className="completed-heading">
        <div><p className="eyebrow">Review history</p><h1 id="completed-title">Completed label review decisions</h1></div>
        <button className="secondary-button" type="button" onClick={onBack}>← Remaining reviews</button>
      </div>
      {completed.length === 0 ? (
        <div className="queue-complete"><div><h2>No completed reviews yet</h2><p>Completed label decisions will appear here.</p></div></div>
      ) : (
        <ol className="queue-list completed-list">
          {completed.map((sample) => {
            const record = progress[sample.id]
            const originalIndex = SAMPLE_LABELS.findIndex((candidate) => candidate.id === sample.id)
            return (
              <li key={sample.id} className={`queue-item queue-${record.finalDecision}`}>
                <button type="button" onClick={() => onOpen(sample.id)}>
                  <span className="queue-number">{originalIndex + 1}</span>
                  <span className="queue-copy"><strong>{sample.name}</strong><small>{sample.description}</small></span>
                  <span className="queue-status">{record.finalDecision === 'pass' ? 'Passed' : 'Failed'}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
