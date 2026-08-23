import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { LABEL_EVIDENCE_CASES, ROUTING_CATEGORIES } from './labelEvidence/cases'
import { selectBalancedCases } from './labelEvidence/batch'
import { evaluateCase } from './labelEvidence/evaluate'
import type { CaseEvaluation, LabelEvidenceCase, ReviewFlag } from './labelEvidence/types'

type FlagDecision = 'confirmed' | 'dismissed'
type FinalDecision = 'approved' | 'returned'
type QueueMode = 'all' | 'batch'

interface TimedEvaluation extends CaseEvaluation { durationMs: number }
interface StoredCaseReview {
  flagDecisions: Record<string, FlagDecision>
  finalDecision?: FinalDecision
  note: string
  decidedAt?: string
}

const REVIEW_STORAGE_KEY = 'labelevidence.reviewer-decisions.v1'
const WELCOME_STORAGE_KEY = 'labelevidence.welcome-seen.v1'

function readStoredReviews(): Record<string, StoredCaseReview> {
  try { return JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 10) return `${milliseconds.toFixed(2)} ms`
  if (milliseconds < 1000) return `${milliseconds.toFixed(0)} ms`
  return `${(milliseconds / 1000).toFixed(2)} seconds`
}

function LabelArtwork({ item, rotation = 0, brightness = 100, contrast = 100, zoom = 100 }: {
  item: LabelEvidenceCase
  rotation?: number
  brightness?: number
  contrast?: number
  zoom?: number
}) {
  const label = item.label
  return (
    <div className="label-artwork-viewport">
      <div
        className={`label-artwork ${label.imageQuality === 'limited' ? 'label-artwork-limited' : ''}`}
        style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})`, filter: `brightness(${brightness}%) contrast(${contrast}%) ${label.imageQuality === 'limited' ? 'blur(.75px)' : ''}` }}
        aria-label={`Label artwork for ${item.displayName}`}
      >
        <p className="label-artwork-kicker">{item.category.shortLabel}</p>
        <h2>{label.brandName}</h2>
        <p className="label-artwork-type">{label.classType}</p>
        {label.claims.map((claim) => <p className="label-artwork-claim" key={claim.text}>{claim.text}</p>)}
        <div className="label-artwork-facts"><strong>{label.alcoholContent}</strong><strong>{label.netContents}</strong></div>
        <p>{label.responsibleParty}</p>
        {label.countryOrigin && <p>Product of {label.countryOrigin}</p>}
        {label.declarations.map((declaration) => <p key={declaration}>{declaration}</p>)}
        {label.warning.present && <div className="label-warning"><strong className={label.warning.headingBold ? '' : 'not-bold'}>{label.warning.headingCapitalized ? 'GOVERNMENT WARNING:' : 'Government Warning:'}</strong><span>According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.</span></div>}
      </div>
    </div>
  )
}

function FlagIcon({ flag }: { flag: ReviewFlag }) {
  const label = flag.kind === 'image_quality' ? 'Image' : flag.kind.includes('claim') ? 'Claim' : flag.kind === 'evidence' ? 'Evidence' : 'Check'
  return <span className={`flag-kind flag-kind-${flag.kind}`}>{label}</span>
}

function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="welcome-page">
      <section className="welcome-hero"><p className="eyebrow">LabelEvidence prototype</p><h1>Evidence-led alcohol label review, built around the human decision.</h1><p>LabelEvidence compares a submitted label with its application facts, supporting evidence, and the disclosure checks routed to that product. It brings suspected problems to the reviewer and keeps the supporting material close.</p><button className="primary-button" type="button" onClick={onContinue}>Enter the review workspace</button></section>
      <section className="welcome-explainer" aria-label="What this demonstration shows"><article><span>01</span><h2>Apply the right review profile</h2><p>Wine, distilled spirits, and malt beverages are routed using source and other product facts.</p></article><article><span>02</span><h2>Surface only the exceptions</h2><p>Possible mismatches, missing disclosures, unsupported claims, evidence gaps, and unreadable areas go to a person.</p></article><article><span>03</span><h2>Let the reviewer decide</h2><p>The reviewer confirms or dismisses concerns, then approves the label or returns it for correction.</p></article></section>
      <section className="welcome-coverage"><div><p className="eyebrow">Demonstration coverage</p><h2>56 independent cases across eight review profiles</h2></div><div className="welcome-profile-grid">{ROUTING_CATEGORIES.map((category) => <p key={category.id}>{category.label}<small>7 cases</small></p>)}</div></section>
      <p className="prototype-note"><strong>Prototype boundary:</strong> This demonstration uses controlled local case data and a local rules-based evaluator. It does not connect to TTB systems or make autonomous regulatory decisions.</p>
    </main>
  )
}

function CaseDetail({ item, evaluation, review, onReviewChange, onClose, onPrevious, onNext, hasPrevious, hasNext, onRerun }: {
  item: LabelEvidenceCase
  evaluation: TimedEvaluation
  review: StoredCaseReview
  onReviewChange: (review: StoredCaseReview) => void
  onClose: () => void
  onPrevious: () => void
  onNext: () => void
  hasPrevious: boolean
  hasNext: boolean
  onRerun: () => void
}) {
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [zoom, setZoom] = useState(100)
  const addressed = evaluation.flags.filter((flag) => review.flagDecisions[flag.id]).length
  const allAddressed = addressed === evaluation.flags.length
  const confirmed = evaluation.flags.filter((flag) => review.flagDecisions[flag.id] === 'confirmed').length
  function decideFlag(flagId: string, decision: FlagDecision) { onReviewChange({ ...review, finalDecision: undefined, decidedAt: undefined, flagDecisions: { ...review.flagDecisions, [flagId]: decision } }) }
  function makeFinalDecision(finalDecision: FinalDecision) { onReviewChange({ ...review, finalDecision, decidedAt: new Date().toISOString() }) }
  function resetImage() { setRotation(0); setBrightness(100); setContrast(100); setZoom(100) }

  return (
    <div className="detail-backdrop" role="presentation">
      <section className="case-detail" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
        <header><div className="detail-navigation"><button type="button" onClick={onPrevious} disabled={!hasPrevious}>← Previous</button><div><p className="eyebrow">{item.id} · {item.category.label}</p><h1 id="case-detail-title">{item.displayName}</h1><p>{evaluation.flags.length ? `${addressed} of ${evaluation.flags.length} concerns addressed` : 'No red flags detected'} · Evaluated in {formatDuration(evaluation.durationMs)}</p></div><button type="button" onClick={onNext} disabled={!hasNext}>Next →</button></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close label review">×</button></header>
        <div className="case-detail-grid">
          <div className="artwork-column">
            <div className="artwork-tools-heading"><span>Submitted label</span><details><summary>Edit / enhance image</summary><div className="image-tools"><label>Zoom <input type="range" min="75" max="150" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label>Brightness <input type="range" min="60" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label><label>Contrast <input type="range" min="60" max="160" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label><div><button type="button" onClick={() => setRotation((value) => value - 90)}>Rotate left</button><button type="button" onClick={() => setRotation((value) => value + 90)}>Rotate right</button><button type="button" onClick={resetImage}>Reset image</button></div><small>Viewing adjustments do not replace or alter the submitted evidence.</small></div></details></div>
            <LabelArtwork item={item} rotation={rotation} brightness={brightness} contrast={contrast} zoom={zoom} />
            <details className="application-details"><summary>Application and evidence</summary><dl><div><dt>Brand</dt><dd>{item.application.brandName}</dd></div><div><dt>Class/type</dt><dd>{item.application.classType}</dd></div><div><dt>Alcohol</dt><dd>{item.application.alcoholContent}</dd></div><div><dt>Source</dt><dd>{item.application.source === 'imported' ? `Imported${item.application.countryOrigin ? ` · ${item.application.countryOrigin}` : ''}` : 'Domestic'}</dd></div><div><dt>Formula</dt><dd>{item.application.formula.required ? item.application.formula.id ?? 'Required; record unavailable' : 'Not required in case record'}</dd></div></dl></details>
          </div>
          <div className="finding-column">
            <div className="rerun-row"><button type="button" onClick={onRerun}>Rerun AI evaluation</button><span>Latest evaluation: {formatDuration(evaluation.durationMs)}</span></div>
            {evaluation.flags.length ? <><div className="finding-heading"><p className="eyebrow">Human attention required</p><h2>What LabelEvidence struggled with</h2><p>Confirm or dismiss every concern, then make the case decision.</p></div><div className="flag-list">{evaluation.flags.map((flag) => { const decision = review.flagDecisions[flag.id]; return <article className="flag-card" key={flag.id}><div className="flag-card-heading"><FlagIcon flag={flag} /><h3>{flag.title}</h3></div><p>{flag.detail}</p>{(flag.applicationValue || flag.labelValue) && <dl className="comparison-values">{flag.applicationValue && <div><dt>Application</dt><dd>{flag.applicationValue}</dd></div>}{flag.labelValue && <div><dt>Label</dt><dd>{flag.labelValue}</dd></div>}</dl>}<div className="flag-actions" aria-label={`Decision for ${flag.title}`}><button className={decision === 'confirmed' ? 'selected confirm' : ''} type="button" onClick={() => decideFlag(flag.id, 'confirmed')}>Confirm concern</button><button className={decision === 'dismissed' ? 'selected dismiss' : ''} type="button" onClick={() => decideFlag(flag.id, 'dismissed')}>Dismiss concern</button></div></article> })}</div></> : <div className="clear-review-message"><span aria-hidden="true">✓</span><h2>No red flags detected</h2><p>Required comparisons and disclosure checks completed without identifying a concern.</p></div>}
            <details className="complete-review"><summary>View complete review ({evaluation.checks.length} checks)</summary><div>{evaluation.checks.map((check) => <p key={check.id}><span className={check.status === 'confirmed' ? 'check-pass' : 'check-flag'}>{check.status === 'confirmed' ? 'Confirmed' : 'Flagged'}</span><strong>{check.label}</strong><small>{check.detail}</small></p>)}</div></details>
            <section className="final-decision-panel"><div><p className="eyebrow">Final human decision</p><h2>{review.finalDecision === 'approved' ? 'Approved' : review.finalDecision === 'returned' ? 'Returned for correction' : 'Decision required'}</h2><p>{evaluation.flags.length && !allAddressed ? 'Address every concern before making the final decision.' : confirmed ? `${confirmed} confirmed concern${confirmed === 1 ? '' : 's'} remain.` : 'No confirmed concerns remain.'}</p></div><label>Reviewer note<textarea value={review.note} onChange={(event) => onReviewChange({ ...review, note: event.target.value })} placeholder="Optional note about the decision" /></label><div className="final-decision-actions"><button className={review.finalDecision === 'approved' ? 'decision-approved' : ''} type="button" disabled={!allAddressed || confirmed > 0} onClick={() => makeFinalDecision('approved')}>Approve label</button><button className={review.finalDecision === 'returned' ? 'decision-returned' : ''} type="button" disabled={!allAddressed || confirmed === 0} onClick={() => makeFinalDecision('returned')}>Return for correction</button></div>{review.decidedAt && <small>Saved on this device · {new Date(review.decidedAt).toLocaleString()}</small>}</section>
          </div>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [welcomeVisible, setWelcomeVisible] = useState(() => window.localStorage.getItem(WELCOME_STORAGE_KEY) !== 'true')
  const [mode, setMode] = useState<QueueMode>('all')
  const [activeCaseIds, setActiveCaseIds] = useState(() => LABEL_EVIDENCE_CASES.map((item) => item.id))
  const [evaluations, setEvaluations] = useState<Record<string, TimedEvaluation>>({})
  const [reviews, setReviews] = useState<Record<string, StoredCaseReview>>(readStoredReviews)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [bulkAttested, setBulkAttested] = useState(false)
  const [evaluationRun, setEvaluationRun] = useState(0)
  const activeIdsRef = useRef(activeCaseIds)
  const casesById = useMemo(() => new Map(LABEL_EVIDENCE_CASES.map((item) => [item.id, item])), [])

  useEffect(() => { document.title = 'LabelEvidence · Alcohol label review' }, [])
  useEffect(() => { window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews)) }, [reviews])
  useEffect(() => { activeIdsRef.current = activeCaseIds }, [activeCaseIds])
  useEffect(() => {
    if (welcomeVisible) return
    setEvaluations({})
    let index = 0
    const ids = [...activeIdsRef.current]
    const timer = window.setInterval(() => {
      const caseId = ids[index]
      if (!caseId) { window.clearInterval(timer); return }
      const item = casesById.get(caseId)!
      const start = performance.now()
      const result = evaluateCase(item)
      setEvaluations((current) => ({ ...current, [caseId]: { ...result, durationMs: Math.max(performance.now() - start, 0.01) } }))
      index += 1
      if (index >= ids.length) window.clearInterval(timer)
    }, 45)
    return () => window.clearInterval(timer)
  }, [casesById, evaluationRun, welcomeVisible])

  const evaluated = activeCaseIds.map((id) => evaluations[id]).filter((value): value is TimedEvaluation => Boolean(value))
  const flagged = evaluated.filter((evaluation) => evaluation.flags.length > 0)
  const clear = evaluated.filter((evaluation) => evaluation.flags.length === 0)
  const queueOrder = [...flagged, ...clear].map((evaluation) => evaluation.caseId)
  const completedCount = activeCaseIds.filter((id) => reviews[id]?.finalDecision).length
  const selectedIndex = selectedCaseId ? queueOrder.indexOf(selectedCaseId) : -1
  const selectedCase = selectedCaseId ? casesById.get(selectedCaseId) : undefined
  const selectedEvaluation = selectedCaseId ? evaluations[selectedCaseId] : undefined
  const selectedReview = selectedCaseId ? reviews[selectedCaseId] ?? { flagDecisions: {}, note: '' } : undefined

  function enterWorkspace() { window.localStorage.setItem(WELCOME_STORAGE_KEY, 'true'); setWelcomeVisible(false) }
  function updateReview(caseId: string, review: StoredCaseReview) { setReviews((current) => ({ ...current, [caseId]: review })) }
  function rerunEvaluation(caseId: string) { const item = casesById.get(caseId)!; const start = performance.now(); const result = evaluateCase(item); setEvaluations((current) => ({ ...current, [caseId]: { ...result, durationMs: Math.max(performance.now() - start, 0.01) } })) }
  function createBatch() { const selected = selectBalancedCases(Date.now()); setMode('batch'); setActiveCaseIds(selected.map((item) => item.id)); setSelectedCaseId(null); setBulkAttested(false); setEvaluationRun((value) => value + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function showAllCases() { setMode('all'); setActiveCaseIds(LABEL_EVIDENCE_CASES.map((item) => item.id)); setSelectedCaseId(null); setBulkAttested(false); setEvaluationRun((value) => value + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function resetData() { if (!window.confirm('Reset all evaluations and reviewer decisions? The welcome page will remain dismissed.')) return; window.localStorage.removeItem(REVIEW_STORAGE_KEY); setReviews({}); setSelectedCaseId(null); setBulkAttested(false); setEvaluationRun((value) => value + 1) }
  function bulkApproveClear() { if (!bulkAttested) return; const next = { ...reviews }; for (const evaluation of clear) if (!next[evaluation.caseId]?.finalDecision) next[evaluation.caseId] = { flagDecisions: {}, note: 'Approved from the no-red-flags queue.', finalDecision: 'approved', decidedAt: new Date().toISOString() }; setReviews(next); setBulkAttested(false) }

  if (welcomeVisible) return <Welcome onContinue={enterWorkspace} />

  return (
    <div className="app-shell">
      <header className="site-header"><button className="wordmark" type="button" onClick={() => setWelcomeVisible(true)} aria-label="LabelEvidence home"><span className="wordmark-mark" aria-hidden="true">LE</span><span>LabelEvidence</span></button><nav className="site-nav" aria-label="Primary navigation"><span className="prototype-badge">Prototype · Human decision support</span><button type="button" onClick={resetData}>Reset all data</button></nav></header>
      <main id="top" className="workspace-main">
        <section className="workspace-heading"><div><p className="eyebrow">Individual label review</p><h1>{mode === 'all' ? 'Review queue' : 'Simulated batch of 40'}</h1><p>{mode === 'all' ? 'Possible problems appear first. Labels with no detected red flags remain available below.' : 'A category-balanced selection of 40 labels, presented through the same individual-review workflow.'}</p></div><div className="workspace-actions">{mode === 'batch' && <button className="secondary-button" type="button" onClick={showAllCases}>Return to all 56 labels</button>}<button className="primary-button" type="button" onClick={createBatch}>Create simulated batch of 40</button></div></section>
        <section className="processing-summary" aria-live="polite"><div><strong>{evaluated.length}</strong><span>of {activeCaseIds.length} pre-evaluated</span></div><div><strong>{flagged.length}</strong><span>need human review</span></div><div><strong>{clear.length}</strong><span>no red flags detected</span></div><div><strong>{completedCount}</strong><span>human decisions saved</span></div>{evaluated.length < activeCaseIds.length && <div className="processing-line"><span style={{ width: `${(evaluated.length / activeCaseIds.length) * 100}%` }} /></div>}</section>
        <section className="review-group review-group-flags"><header><div><p className="eyebrow">Start here</p><h2>Needs human review</h2><p>Open a label, address its specific concerns, and make the final decision.</p></div><span>{flagged.length} ready</span></header><div className="case-table" role="table" aria-label="Labels needing human review">{flagged.map((evaluation) => { const item = casesById.get(evaluation.caseId)!; const review = reviews[item.id]; const addressed = evaluation.flags.filter((flag) => review?.flagDecisions[flag.id]).length; return <button className="case-row" type="button" role="row" key={item.id} onClick={() => setSelectedCaseId(item.id)}><span className="case-id">{item.id}</span><span className="case-name"><strong>{item.displayName}</strong><small>{item.category.shortLabel} · {formatDuration(evaluation.durationMs)}</small></span><span className="case-reasons">{evaluation.flags.map((flag) => flag.title).join(' · ')}</span><span className={`case-status ${review?.finalDecision ?? ''}`}>{review?.finalDecision === 'approved' ? 'Approved' : review?.finalDecision === 'returned' ? 'Returned' : `${addressed}/${evaluation.flags.length} addressed`}</span><span aria-hidden="true">›</span></button>})}</div></section>
        <section className="review-group review-group-clear"><header><div><p className="eyebrow">Review or approve</p><h2>No red flags detected</h2><p>These labels still remain available for human inspection and final approval.</p></div><span>{clear.length} ready</span></header>{clear.length > 0 && <div className="bulk-toolbar"><label><input type="checkbox" checked={bulkAttested} onChange={(event) => setBulkAttested(event.target.checked)} />I reviewed the no-red-flags group and authorize approval.</label><button type="button" disabled={!bulkAttested} onClick={bulkApproveClear}>Approve all remaining clear labels</button></div>}<div className="clear-case-grid">{clear.map((evaluation) => { const item = casesById.get(evaluation.caseId)!; const decision = reviews[item.id]?.finalDecision; return <article className={decision ? `clear-case ${decision}` : 'clear-case'} key={item.id}><button type="button" onClick={() => setSelectedCaseId(item.id)}><strong>{item.displayName}</strong><small>{item.category.shortLabel} · {formatDuration(evaluation.durationMs)}</small><span>{decision === 'approved' ? 'Approved' : decision === 'returned' ? 'Returned' : 'Open review'}</span></button></article>})}</div></section>
      </main>
      {selectedCase && selectedEvaluation && selectedReview && <CaseDetail key={selectedCase.id} item={selectedCase} evaluation={selectedEvaluation} review={selectedReview} onReviewChange={(review) => updateReview(selectedCase.id, review)} onClose={() => setSelectedCaseId(null)} onPrevious={() => setSelectedCaseId(queueOrder[selectedIndex - 1])} onNext={() => setSelectedCaseId(queueOrder[selectedIndex + 1])} hasPrevious={selectedIndex > 0} hasNext={selectedIndex >= 0 && selectedIndex < queueOrder.length - 1} onRerun={() => rerunEvaluation(selectedCase.id)} />}
    </div>
  )
}

export default App
