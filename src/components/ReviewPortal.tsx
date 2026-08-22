import { useMemo, useState } from 'react'
import { SAMPLE_LABELS } from '../data/sampleLabels'
import { reviewContextFromApplication, selectAutomaticRuleSet } from '../domain/ruleEngine'
import type { ApplicationData } from '../domain/reviewSchema'
import { RULE_SET_SPECIFICATIONS } from '../domain/ruleSpecification'
import { currentReviewForSample, type QueueProgress } from '../reviewQueue'

type ProductFilter = 'all' | ApplicationData['productType']
type SourceFilter = 'all' | ApplicationData['source']

type Props = {
  progress: QueueProgress
  onStart: () => void
  onSelect: (id: (typeof SAMPLE_LABELS)[number]['id']) => void
  onCompleted: () => void
  onCasePreview: () => void
  onReset: () => void
}

const productLabels: Record<ApplicationData['productType'], string> = {
  distilled_spirits: 'Distilled spirits',
  wine: 'Wine',
  malt_beverage: 'Malt beverage',
}

function queueRow(sample: (typeof SAMPLE_LABELS)[number]) {
  const selection = selectAutomaticRuleSet(reviewContextFromApplication(sample.application))
  const ruleSet = RULE_SET_SPECIFICATIONS.find((entry) => entry.id === selection.selectedRuleSetId)
  return {
    sample,
    productLabel: productLabels[sample.application.productType],
    sourceLabel: sample.application.source === 'imported' ? 'Imported' : 'Domestic',
    ruleSetId: ruleSet?.id ?? 'missing-context',
    ruleSetLabel: ruleSet?.label ?? 'More context needed',
  }
}

export function ReviewPortal({ progress, onStart, onSelect, onCompleted, onCasePreview, onReset }: Props) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [query, setQuery] = useState('')
  const [productFilter, setProductFilter] = useState<ProductFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [ruleSetFilter, setRuleSetFilter] = useState('all')
  const remainingSamples = SAMPLE_LABELS.filter((sample) => !currentReviewForSample(progress, sample.id))
  const rows = useMemo(() => remainingSamples.map(queueRow), [remainingSamples])
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (productFilter !== 'all' && row.sample.application.productType !== productFilter) return false
      if (sourceFilter !== 'all' && row.sample.application.source !== sourceFilter) return false
      if (ruleSetFilter !== 'all' && row.ruleSetId !== ruleSetFilter) return false
      if (!normalizedQuery) return true
      return `${row.sample.name} ${row.sample.description} ${row.productLabel} ${row.sourceLabel} ${row.ruleSetLabel}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [productFilter, query, rows, ruleSetFilter, sourceFilter])
  const availableRuleSets = useMemo(() => (
    Array.from(new Map(rows.map((row) => [row.ruleSetId, row.ruleSetLabel])).entries())
      .sort((left, right) => left[1].localeCompare(right[1]))
  ), [rows])
  const completed = SAMPLE_LABELS.length - remainingSamples.length

  return (
    <section className="queue-portal" aria-labelledby="queue-title">
      <div className="queue-hero">
        <div>
          <p className="eyebrow">Review portal</p>
          <h1 id="queue-title">Labels to Review</h1>
          <p>Search and filter the remaining demonstration labels, then open the case you want to review.</p>
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
        <button className="secondary-button" type="button" onClick={onCasePreview}>Preview document-aware review</button>
        {completed > 0 && (
          <button className="secondary-button" type="button" onClick={onCompleted}>View completed label review decisions</button>
        )}
      </div>

      {remainingSamples.length === 0 ? (
        <div className="queue-complete" role="status">
          <span aria-hidden="true">✓</span>
          <div><h2>No reviews remaining</h2><p>Every demonstration label has a final staff decision.</p></div>
        </div>
      ) : (
        <>
          <div className="review-table-toolbar" aria-label="Remaining review controls">
            <label className="review-table-search">
              <span>Search labels to review</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Label, scenario, source, or rule set" />
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
                <option value="all">Domestic and imported</option>
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
          </div>

          <p className="review-table-count" role="status">Showing {filteredRows.length} of {remainingSamples.length} labels to review</p>
          {filteredRows.length === 0 ? (
            <div className="completed-empty" role="status"><h2>No matching labels</h2><p>Try another keyword or filter.</p></div>
          ) : (
            <div className="review-table-scroll">
              <table className="review-table">
                <caption className="visually-hidden">Labels waiting for review</caption>
                <thead>
                  <tr><th scope="col">Label and scenario</th><th scope="col">Product</th><th scope="col">Source</th><th scope="col">Rule set</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Action</span></th></tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.sample.id}>
                      <td><strong>{row.sample.name}</strong><small>{row.sample.description}</small></td>
                      <td>{row.productLabel}</td>
                      <td>{row.sourceLabel}</td>
                      <td>{row.ruleSetLabel}</td>
                      <td><span className="table-status table-status-pending">To review</span></td>
                      <td><button className="table-action" type="button" onClick={() => onSelect(row.sample.id)} aria-label={`Review ${row.sample.name}`}>Review</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

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
