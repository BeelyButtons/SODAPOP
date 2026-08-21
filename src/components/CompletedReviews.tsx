import { useMemo, useState } from 'react'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import { reviewContextFromApplication, selectAutomaticRuleSet } from '../domain/ruleEngine'
import type { ApplicationData } from '../domain/reviewSchema'
import { RULE_SET_SPECIFICATIONS } from '../domain/ruleSpecification'
import { currentReviewRecords, type QueueDecision, type QueueProgress } from '../reviewQueue'

type DecisionFilter = 'all' | QueueDecision
type DateSort = 'newest' | 'oldest'
type ProductFilter = 'all' | ApplicationData['productType']
type SourceFilter = 'all' | ApplicationData['source']

type Props = {
  progress: QueueProgress
  onBack: () => void
  onOpen: (reviewId: string) => void
}

const productLabels: Record<ApplicationData['productType'], string> = {
  distilled_spirits: 'Distilled spirits',
  wine: 'Wine',
  malt_beverage: 'Malt beverage',
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
  const [productFilter, setProductFilter] = useState<ProductFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [ruleSetFilter, setRuleSetFilter] = useState('all')
  const [dateSort, setDateSort] = useState<DateSort>('newest')
  const allRows = useMemo(() => currentReviewRecords(progress)
    .map((record) => {
      const sample = SAMPLE_LABELS.find((entry) => entry.id === record.sampleId)
      if (!sample) return null
      const selectedRuleSetId = record.result?.ruleSelection?.selectedRuleSetId
        ?? selectAutomaticRuleSet(reviewContextFromApplication(sample.application)).selectedRuleSetId
      const ruleSet = RULE_SET_SPECIFICATIONS.find((entry) => entry.id === selectedRuleSetId)
      return {
        record,
        sample,
        productLabel: productLabels[sample.application.productType],
        sourceLabel: sample.application.source === 'imported' ? 'Imported' : 'Domestic',
        ruleSetId: ruleSet?.id ?? 'missing-context',
        ruleSetLabel: ruleSet?.label ?? 'More context needed',
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null), [progress])
  const completed = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return allRows
      .filter(({ record, sample, productLabel, sourceLabel, ruleSetId, ruleSetLabel }) => {
        if (decisionFilter !== 'all' && record.finalDecision !== decisionFilter) return false
        if (productFilter !== 'all' && sample.application.productType !== productFilter) return false
        if (sourceFilter !== 'all' && sample.application.source !== sourceFilter) return false
        if (ruleSetFilter !== 'all' && ruleSetId !== ruleSetFilter) return false
        if (!normalizedQuery) return true
        return `${sample.name} ${sample.description} ${record.id} ${productLabel} ${sourceLabel} ${ruleSetLabel}`
          .toLowerCase()
          .includes(normalizedQuery)
      })
      .sort((left, right) => {
        const leftTime = Date.parse(left.record.completedAt) || 0
        const rightTime = Date.parse(right.record.completedAt) || 0
        return dateSort === 'newest' ? rightTime - leftTime : leftTime - rightTime
      })
  }, [allRows, dateSort, decisionFilter, productFilter, query, ruleSetFilter, sourceFilter])
  const availableRuleSets = useMemo(() => (
    Array.from(new Map(allRows.map((row) => [row.ruleSetId, row.ruleSetLabel])).entries())
      .sort((left, right) => left[1].localeCompare(right[1]))
  ), [allRows])
  const totalCompleted = allRows.length

  return (
    <section className="completed-reviews" aria-labelledby="completed-title">
      <div className="completed-heading">
        <div><p className="eyebrow">Review history</p><h1 id="completed-title">Completed label review decisions</h1></div>
        <button className="secondary-button" type="button" onClick={onBack}>← Remaining reviews</button>
      </div>

      {totalCompleted > 0 && (
        <div className="review-table-toolbar completed-toolbar" aria-label="Completed review controls">
          <label className="review-table-search completed-search">
            <span>Search completed reviews</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Label, description, decision ID, or rule set" />
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
            <span>Product</span>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value as ProductFilter)}>
              <option value="all">All products</option>
              <option value="distilled_spirits">Distilled spirits</option>
              <option value="wine">Wine</option>
              <option value="malt_beverage">Malt beverage</option>
            </select>
          </label>
          <label>
            <span>Source</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
              <option value="all">All sources</option>
              <option value="domestic">Domestic</option>
              <option value="imported">Imported</option>
            </select>
          </label>
          <label>
            <span>Rule set</span>
            <select value={ruleSetFilter} onChange={(event) => setRuleSetFilter(event.target.value)}>
              <option value="all">All rule sets</option>
              {availableRuleSets.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
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
        <div className="completed-empty" role="status"><h2>No matching decisions</h2><p>Try another keyword or filter.</p></div>
      ) : (
        <>
          <p className="review-table-count completed-result-count" role="status">Showing {completed.length} of {totalCompleted} completed decisions</p>
          <div className="review-table-scroll">
            <table className="review-table completed-review-table">
              <caption className="visually-hidden">Completed label review decisions</caption>
              <thead>
                <tr><th scope="col">Label and decision ID</th><th scope="col">Product</th><th scope="col">Source</th><th scope="col">Rule set</th><th scope="col">Decision</th><th scope="col">Decision date</th><th scope="col"><span className="visually-hidden">Action</span></th></tr>
              </thead>
              <tbody>
                {completed.map(({ record, sample, productLabel, sourceLabel, ruleSetLabel }) => (
                  <tr key={record.id}>
                    <td><strong>{sample.name}</strong><small>{sample.description}</small><span className="completed-meta">Decision ID {record.id}</span></td>
                    <td>{productLabel}</td>
                    <td>{sourceLabel}</td>
                    <td>{ruleSetLabel}</td>
                    <td><span className={`table-status table-status-${record.finalDecision}`}>{record.finalDecision === 'pass' ? 'Passed' : 'Failed'}</span></td>
                    <td>{decisionDate(record.completedAt)}</td>
                    <td><button className="table-action" type="button" onClick={() => onOpen(record.id)} aria-label={`Open ${sample.name} decision`}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
