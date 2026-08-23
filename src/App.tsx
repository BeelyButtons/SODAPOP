import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { LABEL_EVIDENCE_CASES, ROUTING_CATEGORIES } from './labelEvidence/cases'
import { createSimulatedBatch } from './labelEvidence/batch'
import type { CaseEvaluation, LabelEvidenceCase, ReviewFlag, SimulatedBatch } from './labelEvidence/types'

type BatchStatus = 'idle' | 'running' | 'complete'
type FlagDecision = 'confirmed' | 'dismissed'

function LabelArtwork({ item }: { item: LabelEvidenceCase }) {
  const label = item.label
  return (
    <div className={`label-artwork ${label.imageQuality === 'limited' ? 'label-artwork-limited' : ''}`} aria-label={`Label artwork for ${item.displayName}`}>
      <p className="label-artwork-kicker">{item.category.shortLabel}</p>
      <h2>{label.brandName}</h2>
      <p className="label-artwork-type">{label.classType}</p>
      {label.claims.map((claim) => <p className="label-artwork-claim" key={claim.text}>{claim.text}</p>)}
      <div className="label-artwork-facts"><strong>{label.alcoholContent}</strong><strong>{label.netContents}</strong></div>
      <p>{label.responsibleParty}</p>
      {label.countryOrigin && <p>Product of {label.countryOrigin}</p>}
      {label.declarations.map((declaration) => <p key={declaration}>{declaration}</p>)}
      {label.warning.present && (
        <div className="label-warning">
          <strong className={label.warning.headingBold ? '' : 'not-bold'}>{label.warning.headingCapitalized ? 'GOVERNMENT WARNING:' : 'Government Warning:'}</strong>
          <span>According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.</span>
        </div>
      )}
    </div>
  )
}

function FlagIcon({ flag }: { flag: ReviewFlag }) {
  const label = flag.kind === 'image_quality' ? 'Image' : flag.kind.includes('claim') ? 'Claim' : flag.kind === 'evidence' ? 'Evidence' : 'Check'
  return <span className={`flag-kind flag-kind-${flag.kind}`}>{label}</span>
}

function CaseDetail({ item, evaluation, decisions, onDecision, onClose }: {
  item: LabelEvidenceCase
  evaluation: CaseEvaluation
  decisions: Record<string, FlagDecision>
  onDecision: (flagId: string, decision: FlagDecision) => void
  onClose: () => void
}) {
  const addressed = evaluation.flags.filter((flag) => decisions[`${item.id}:${flag.id}`]).length
  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="case-detail" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
        <header>
          <div><p className="eyebrow">{item.id} · {item.category.label}</p><h1 id="case-detail-title">{item.displayName}</h1><p>{evaluation.flags.length ? `${addressed} of ${evaluation.flags.length} concerns addressed` : 'No red flags detected'}</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close label review">×</button>
        </header>
        <div className="case-detail-grid">
          <div className="artwork-column">
            <LabelArtwork item={item} />
            <details className="application-details">
              <summary>Application and evidence</summary>
              <dl>
                <div><dt>Brand</dt><dd>{item.application.brandName}</dd></div>
                <div><dt>Class/type</dt><dd>{item.application.classType}</dd></div>
                <div><dt>Alcohol</dt><dd>{item.application.alcoholContent}</dd></div>
                <div><dt>Formula</dt><dd>{item.application.formula.required ? item.application.formula.id ?? 'Required; record unavailable' : 'Not required in case record'}</dd></div>
              </dl>
            </details>
          </div>
          <div className="finding-column">
            {evaluation.flags.length ? (
              <>
                <div className="finding-heading"><p className="eyebrow">Human attention required</p><h2>What LabelEvidence struggled with</h2><p>Confirm or dismiss every concern. Successful checks are available below.</p></div>
                <div className="flag-list">
                  {evaluation.flags.map((flag) => {
                    const decision = decisions[`${item.id}:${flag.id}`]
                    return (
                      <article className="flag-card" key={flag.id}>
                        <div className="flag-card-heading"><FlagIcon flag={flag} /><h3>{flag.title}</h3></div>
                        <p>{flag.detail}</p>
                        {(flag.applicationValue || flag.labelValue) && (
                          <dl className="comparison-values">
                            {flag.applicationValue && <div><dt>Application</dt><dd>{flag.applicationValue}</dd></div>}
                            {flag.labelValue && <div><dt>Label</dt><dd>{flag.labelValue}</dd></div>}
                          </dl>
                        )}
                        <div className="flag-actions" aria-label={`Decision for ${flag.title}`}>
                          <button className={decision === 'confirmed' ? 'selected confirm' : ''} type="button" onClick={() => onDecision(flag.id, 'confirmed')}>Confirm concern</button>
                          <button className={decision === 'dismissed' ? 'selected dismiss' : ''} type="button" onClick={() => onDecision(flag.id, 'dismissed')}>Dismiss concern</button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="clear-review-message"><span aria-hidden="true">✓</span><h2>No red flags detected</h2><p>Required comparisons and disclosure checks completed without identifying a concern.</p></div>
            )}
            <details className="complete-review">
              <summary>View complete review ({evaluation.checks.length} checks)</summary>
              <div>{evaluation.checks.map((check) => <p key={check.id}><span className={check.status === 'confirmed' ? 'check-pass' : 'check-flag'}>{check.status === 'confirmed' ? 'Confirmed' : 'Flagged'}</span><strong>{check.label}</strong><small>{check.detail}</small></p>)}</div>
            </details>
          </div>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [status, setStatus] = useState<BatchStatus>('idle')
  const [processed, setProcessed] = useState(0)
  const [batch, setBatch] = useState<SimulatedBatch | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedClearCases, setSelectedClearCases] = useState<Set<string>>(new Set())
  const [attested, setAttested] = useState(false)
  const [bulkApproved, setBulkApproved] = useState<Set<string>>(new Set())
  const [flagDecisions, setFlagDecisions] = useState<Record<string, FlagDecision>>({})

  useEffect(() => { document.title = 'LabelEvidence · Alcohol label review' }, [])
  useEffect(() => {
    if (status !== 'running') return
    const timer = window.setInterval(() => {
      setProcessed((current) => {
        if (current >= 39) { window.clearInterval(timer); setStatus('complete'); return 40 }
        return current + 1
      })
    }, 28)
    return () => window.clearInterval(timer)
  }, [status])

  const casesById = useMemo(() => new Map(LABEL_EVIDENCE_CASES.map((item) => [item.id, item])), [])
  const flagged = batch?.evaluations.filter((evaluation) => evaluation.flags.length > 0) ?? []
  const clear = batch?.evaluations.filter((evaluation) => evaluation.flags.length === 0) ?? []
  const selectedEvaluation = batch?.evaluations.find((evaluation) => evaluation.caseId === selectedCaseId)
  const selectedCase = selectedCaseId ? casesById.get(selectedCaseId) : undefined

  function startBatch() {
    setBatch(createSimulatedBatch())
    setProcessed(0); setStatus('running'); setSelectedCaseId(null); setSelectedClearCases(new Set()); setBulkApproved(new Set()); setAttested(false); setFlagDecisions({})
  }
  function toggleClearCase(caseId: string) {
    setSelectedClearCases((current) => { const next = new Set(current); if (next.has(caseId)) next.delete(caseId); else next.add(caseId); return next })
  }
  function selectAllClear() { setSelectedClearCases(new Set(clear.map((item) => item.caseId).filter((id) => !bulkApproved.has(id)))) }
  function bulkApprove() {
    if (!attested || selectedClearCases.size === 0) return
    setBulkApproved((current) => new Set([...current, ...selectedClearCases])); setSelectedClearCases(new Set()); setAttested(false)
  }
  function decideFlag(flagId: string, decision: FlagDecision) {
    if (selectedCaseId) setFlagDecisions((current) => ({ ...current, [`${selectedCaseId}:${flagId}`]: decision }))
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="LabelEvidence home"><span className="wordmark-mark" aria-hidden="true">LE</span><span>LabelEvidence</span></a>
        <nav className="site-nav" aria-label="Primary navigation"><a className="active" href="#batch">Batch review</a><a href="#coverage">Case library</a><span className="prototype-badge">Prototype · Human decision support</span></nav>
      </header>
      <main id="top">
        <section className="hero-panel">
          <div><p className="eyebrow">Evidence-led alcohol label review</p><h1>Review the exceptions.<br />Keep the evidence close.</h1><p className="hero-copy">LabelEvidence compares each submitted label with its application, supporting records, and routed disclosure requirements. Human reviewers decide every flagged concern.</p><div className="hero-actions"><button className="primary-button" type="button" onClick={startBatch} disabled={status === 'running'}>{status === 'running' ? 'Reviewing 40 labels…' : 'Create simulated batch of 40'}</button><a className="secondary-link" href="#coverage">See all 56 cases</a></div></div>
          <div className="principle-card"><span>Review principle</span><strong>The system receives no intended answer.</strong><p>Every result is derived from the application, evidence, label information, and image-quality facts supplied to the review.</p></div>
        </section>

        <section className="batch-section" id="batch" aria-live="polite">
          {status === 'idle' && <div className="batch-empty"><div className="batch-empty-icon" aria-hidden="true">40</div><div><h2>No simulated batch is running</h2><p>Create a category-balanced batch containing five labels from each review profile.</p></div></div>}
          {status === 'running' && <div className="batch-progress"><div className="progress-copy"><p className="eyebrow">Batch review in progress</p><h2>Examining label {Math.min(processed + 1, 40)} of 40</h2><p>Routing product facts, checking required disclosures, comparing application details, and identifying optional claims.</p></div><div className="progress-track"><span style={{ width: `${(processed / 40) * 100}%` }} /></div><strong>{Math.round((processed / 40) * 100)}%</strong></div>}
          {status === 'complete' && batch && (
            <div className="batch-results">
              <header className="batch-results-header"><div><p className="eyebrow">{batch.id}</p><h2>Batch review complete</h2><p>LabelEvidence has separated suspected concerns from labels with no detected red flags.</p></div><button className="secondary-button" type="button" onClick={startBatch}>Create another batch</button></header>
              <div className="batch-metrics"><div><strong>40</strong><span>Labels evaluated</span></div><div className="metric-alert"><strong>{flagged.length}</strong><span>Need human review</span></div><div className="metric-clear"><strong>{clear.length}</strong><span>No red flags detected</span></div><div><strong>8</strong><span>Review profiles represented</span></div></div>
              <section className="review-group review-group-flags">
                <header><div><p className="eyebrow">Start here</p><h3>Needs human review</h3><p>Open each label and resolve every concern identified by the system.</p></div><span>{flagged.length} labels</span></header>
                <div className="case-table" role="table" aria-label="Labels needing human review">
                  {flagged.map((evaluation) => { const item = casesById.get(evaluation.caseId)!; const addressed = evaluation.flags.filter((flag) => flagDecisions[`${item.id}:${flag.id}`]).length; return <button className="case-row" type="button" role="row" key={item.id} onClick={() => setSelectedCaseId(item.id)}><span className="case-id">{item.id}</span><span className="case-name"><strong>{item.displayName}</strong><small>{item.category.shortLabel}</small></span><span className="case-reasons">{evaluation.flags.slice(0, 2).map((flag) => flag.title).join(' · ')}</span><span className="case-status">{addressed}/{evaluation.flags.length} addressed</span><span aria-hidden="true">›</span></button> })}
                </div>
              </section>
              <section className="review-group review-group-clear">
                <header><div><p className="eyebrow">Eligible for bulk action</p><h3>No red flags detected</h3><p>Open any label for its complete review or select labels for reviewer-authorized bulk approval.</p></div><span>{clear.length} labels</span></header>
                <div className="bulk-toolbar"><button type="button" onClick={selectAllClear}>Select all unapproved</button><span>{selectedClearCases.size} selected · {bulkApproved.size} approved</span></div>
                <div className="clear-case-grid">{clear.map((evaluation) => { const item = casesById.get(evaluation.caseId)!; const approved = bulkApproved.has(item.id); return <article className={approved ? 'clear-case approved' : 'clear-case'} key={item.id}><label><input type="checkbox" checked={selectedClearCases.has(item.id)} disabled={approved} onChange={() => toggleClearCase(item.id)} /><span>{approved ? 'Approved' : 'Select'}</span></label><button type="button" onClick={() => setSelectedCaseId(item.id)}><strong>{item.displayName}</strong><small>{item.category.shortLabel}</small></button></article> })}</div>
                <div className="attestation-panel"><label><input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} /><span>I understand that LabelEvidence identified no red flags. I reviewed the selected labels and authorize their approval.</span></label><button className="approve-button" type="button" disabled={!attested || selectedClearCases.size === 0} onClick={bulkApprove}>Approve {selectedClearCases.size || ''} selected labels</button></div>
              </section>
            </div>
          )}
        </section>
        <section className="coverage-section" id="coverage"><header><p className="eyebrow">Demonstration coverage</p><h2>56 cases across eight routing profiles</h2><p>Each profile contains seven independent application, evidence, and label packets.</p></header><div className="coverage-grid">{ROUTING_CATEGORIES.map((category) => <article key={category.id}><span>{category.commodity === 'wine' ? 'Wine' : category.commodity === 'distilled_spirits' ? 'Spirits' : 'Malt'}</span><h3>{category.label}</h3><p>7 cases</p></article>)}</div></section>
      </main>
      {selectedCase && selectedEvaluation && <CaseDetail item={selectedCase} evaluation={selectedEvaluation} decisions={flagDecisions} onDecision={decideFlag} onClose={() => setSelectedCaseId(null)} />}
    </div>
  )
}

export default App
