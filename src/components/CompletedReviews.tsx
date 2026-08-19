import { useMemo, useState } from 'react'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import { currentReviewRecords, type QueueDecision, type QueueProgress } from '../reviewQueue'

type DecisionFilter = 'all' | QueueDecision
type DateSort = 'newest' | 'oldest'

type Props = {
  progress: QueueProgress
  onBack: () => void
  onOpen: (reviewId: string) => void
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function decisionDate(value: string) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date)
}

export function CompletedReviews({ progress, onBack, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all')
  const [dateSort, setDateSort] = useState<DateSort>('newest')
  const completed = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return currentReviewRecords(progress)
      .map((record) => ({ record, sample: SAMPLE_LABELS.find((sample) => sample.id === record.sampleId) }))
      .filter((entry) => entry.sample)
      .filter(({ record, sample }) => {
        if (decisionFilter !== 'all' && record.finalDecision !== decisionFilter) return false
        if (!normalizedQuery) return true
        return `${sample!.name} ${sample!.description} ${record.id}`.toLowerCase().includes(normalizedQuery)
      })
      .sort((left, right) => {
        const leftTime = Date.parse(left.record.completedAt) || 0
        const rightTime = Date.parse(right.record.completedAt) || 0
        return dateSort === 'newest' ? rightTime - leftTime : leftTime - rightTime
      })
  }, [dateSort, decisionFilter, progress, query])
  const totalCompleted = currentReviewRecords(progress).length

  return (
    <section className="completed-reviews" aria-labelledby="completed-title">
      <div className="completed-heading">
        <div><p className="eyebrow">Review history</p><h1 id="completed-title">Completed label review decisions</h1></div>
        <button className="secondary-button" type="button" onClick={onBack}>← Remaining reviews</button>
      </div>

      {totalCompleted > 0 && (
        <div className="completed-toolbar" aria-label="Completed review controls">
          <label className="completed-search">
            <span>Search completed reviews</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Label name, description, or decision ID" />
          </label>
          <label>
            <span>Decision</span>
            <select value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value as DecisionFilter)}>
              <option value="all">All decisions</option>
              <option value="pass">Passed</option>
              <option value="fail">Failed</option>
            </select>
          </label>
          <label>
            <span>Decision date</span>
            <select value={dateSort} onChange={(event) => setDateSort(event.target.value as DateSort)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      )}

      {totalCompleted === 0 ? (
        <div className="queue-complete"><div><h2>No completed reviews yet</h2><p>Completed label decisions will appear here.</p></div></div>
      ) : completed.length === 0 ? (
        <div className="completed-empty" role="status"><h2>No matching decisions</h2><p>Try another keyword or decision filter.</p></div>
      ) : (
        <>
          <p className="completed-result-count" role="status">Showing {completed.length} of {totalCompleted} completed decisions</p>
          <ol className="queue-list completed-list">
            {completed.map(({ record, sample }, index) => (
              <li key={record.id} className={`queue-item queue-${record.finalDecision}`}>
                <button type="button" onClick={() => onOpen(record.id)}>
                  <span className="queue-number">{index + 1}</span>
                  <span className="queue-copy">
                    <strong>{sample!.name}</strong>
                    <small>{sample!.description}</small>
                    <span className="completed-meta">{decisionDate(record.completedAt)} · Decision ID {record.id}</span>
                  </span>
                  <span className="queue-status">{record.finalDecision === 'pass' ? 'Passed' : 'Failed'}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
