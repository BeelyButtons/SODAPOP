import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { LABEL_EVIDENCE_CASES, ROUTING_CATEGORIES } from './labelEvidence/cases'
import { selectBalancedCases } from './labelEvidence/batch'
import { evaluateImageCase, type ImageCaseEvaluation } from './labelEvidence/imageEvaluation'
import { createReviewQueue, type ReviewQueueUnit } from './labelEvidence/reviewQueue'
import { warmOcrEngine, type OcrProgress } from './ocr/recognizeLabel'
import type { LabelEvidenceCase, ReviewFlag } from './labelEvidence/types'

type FlagDecision = 'confirmed' | 'dismissed'
type FinalDecision = 'approved' | 'returned'
interface StoredCaseReview { flagDecisions: Record<string, FlagDecision>; finalDecision?: FinalDecision; note: string; decidedAt?: string }
interface ProcessingState extends OcrProgress { caseId: string }

const REVIEW_STORAGE_KEY = 'labelevidence.reviewer-decisions.v2'
const WELCOME_STORAGE_KEY = 'labelevidence.welcome-seen.v1'
const QUEUE_POSITION_KEY = 'labelevidence.queue-position.v1'
const QUEUE_SEED = 20260822

function readStoredReviews(): Record<string, StoredCaseReview> {
  try { return JSON.parse(window.localStorage.getItem(REVIEW_STORAGE_KEY) ?? '{}') } catch { return {} }
}
function readQueuePosition() { const value = Number(window.localStorage.getItem(QUEUE_POSITION_KEY) ?? 0); return Number.isFinite(value) && value >= 0 ? value : 0 }
function formatDuration(milliseconds: number) { return milliseconds < 1000 ? `${Math.max(1, Math.round(milliseconds))} ms` : `${(milliseconds / 1000).toFixed(2)} seconds` }

function FlagIcon({ flag }: { flag: ReviewFlag }) {
  const label = flag.kind === 'image_quality' ? 'Could not verify' : flag.kind.includes('claim') ? 'Claim' : flag.kind === 'evidence' ? 'Evidence' : 'Possible conflict'
  return <span className={`flag-kind flag-kind-${flag.kind}`}>{label}</span>
}

function Welcome({ onContinue }: { onContinue: () => void }) {
  return <main className="welcome-page">
    <div className="welcome-sticky-action"><button className="primary-button" type="button" onClick={onContinue}>Go to LabelEvidence</button></div>
    <section className="welcome-hero"><p className="eyebrow">LabelEvidence prototype</p><h1>Evidence-led alcohol label review, built around the human decision.</h1><p>The application selects the rules. The rules define what must be found. OCR reads the submitted label image. Every required item that cannot be verified—or appears inconsistent—becomes its own human-review concern.</p><button className="primary-button" type="button" onClick={onContinue}>Go to LabelEvidence</button></section>
    <section className="welcome-explainer" aria-label="What this demonstration shows"><article><span>01</span><h2>Select applicable rules</h2><p>Application and evidence facts route wine, spirits, and malt products into the appropriate review questions.</p></article><article><span>02</span><h2>Read the actual image</h2><p>Local OCR examines label pixels and attempts recovery for difficult text or orientation.</p></article><article><span>03</span><h2>Ask a person about uncertainty</h2><p>Each unresolved requirement or conflicting value receives its own confirm-or-dismiss decision.</p></article></section>
    <section className="welcome-coverage"><div><p className="eyebrow">Demonstration coverage</p><h2>56 image-and-application cases across eight review profiles</h2></div><div className="welcome-profile-grid">{ROUTING_CATEGORIES.map((category) => <p key={category.id}>{category.label}<small>7 cases</small></p>)}</div></section>
    <p className="prototype-note"><strong>Prototype boundary:</strong> The OCR and rules engine run locally in the browser. This demonstration does not connect to TTB systems or make autonomous regulatory decisions.</p>
  </main>
}

function LabelImage({ evaluation, rotation, brightness, contrast, zoom }: { evaluation: ImageCaseEvaluation; rotation: number; brightness: number; contrast: number; zoom: number }) {
  return <div className="label-artwork-viewport"><img className="submitted-label-image" src={evaluation.imageUrl} alt="Submitted label evidence" style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})`, filter: `brightness(${brightness}%) contrast(${contrast}%)` }} /></div>
}

function CaseDetail({ item, evaluation, review, onReviewChange, onClose, onPrevious, onNext, hasPrevious, hasNext, onRerun }: {
  item: LabelEvidenceCase; evaluation: ImageCaseEvaluation; review: StoredCaseReview; onReviewChange: (review: StoredCaseReview) => void; onClose: () => void; onPrevious: () => void; onNext: () => void; hasPrevious: boolean; hasNext: boolean; onRerun: () => Promise<void>
}) {
  const [rotation, setRotation] = useState(0), [brightness, setBrightness] = useState(100), [contrast, setContrast] = useState(100), [zoom, setZoom] = useState(100), [rerunning, setRerunning] = useState(false)
  const addressed = evaluation.flags.filter((flag) => review.flagDecisions[flag.id]).length
  const allAddressed = addressed === evaluation.flags.length
  const confirmed = evaluation.flags.filter((flag) => review.flagDecisions[flag.id] === 'confirmed').length
  function decideFlag(flagId: string, decision: FlagDecision) { onReviewChange({ ...review, finalDecision: undefined, decidedAt: undefined, flagDecisions: { ...review.flagDecisions, [flagId]: decision } }) }
  function makeFinalDecision(finalDecision: FinalDecision) { onReviewChange({ ...review, finalDecision, decidedAt: new Date().toISOString() }) }
  function resetImage() { setRotation(0); setBrightness(100); setContrast(100); setZoom(100) }
  async function rerun() { setRerunning(true); try { await onRerun() } finally { setRerunning(false) } }
  return <div className="detail-backdrop" role="presentation"><section className="case-detail" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
    <header><div className="detail-navigation"><button type="button" onClick={onPrevious} disabled={!hasPrevious}>← Previous</button><div><p className="eyebrow">{item.id} · {item.category.label}</p><h1 id="case-detail-title">{item.displayName}</h1><p>{evaluation.flags.length ? `${addressed} of ${evaluation.flags.length} concerns addressed` : 'No red flags detected'} · Total {formatDuration(evaluation.durationMs)}</p></div><button type="button" onClick={onNext} disabled={!hasNext}>Next →</button></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close label review">×</button></header>
    <div className="case-detail-grid"><div className="artwork-column"><div className="artwork-tools-heading"><span>Submitted label image</span><details><summary>Edit / enhance image</summary><div className="image-tools"><label>Zoom <input type="range" min="75" max="150" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label>Brightness <input type="range" min="60" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label><label>Contrast <input type="range" min="60" max="160" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label><div><button type="button" onClick={() => setRotation((value) => value - 90)}>Rotate left</button><button type="button" onClick={() => setRotation((value) => value + 90)}>Rotate right</button><button type="button" onClick={resetImage}>Reset image</button></div><small>Viewing adjustments do not replace or alter the submitted evidence.</small></div></details></div><LabelImage evaluation={evaluation} rotation={rotation} brightness={brightness} contrast={contrast} zoom={zoom} /><details className="application-details"><summary>Application and evidence</summary><dl><div><dt>Brand</dt><dd>{item.application.brandName}</dd></div><div><dt>Class/type</dt><dd>{item.application.classType}</dd></div><div><dt>Alcohol</dt><dd>{item.application.alcoholContent}</dd></div><div><dt>Source</dt><dd>{item.application.source === 'imported' ? `Imported · ${item.application.countryOrigin ?? 'origin not supplied'}` : 'Domestic'}</dd></div><div><dt>Formula</dt><dd>{item.application.formula.required ? item.application.formula.id ?? 'Required; record unavailable' : 'Not required in case record'}</dd></div></dl></details></div>
      <div className="finding-column"><div className="evaluation-metrics"><span><strong>{Math.round(evaluation.ocrConfidence)}%</strong> OCR confidence</span><span><strong>{formatDuration(evaluation.outcome.durationMs)}</strong> image reading</span><span><strong>{formatDuration(evaluation.rulesDurationMs)}</strong> rules comparison</span></div><div className="rerun-row"><button type="button" disabled={rerunning} onClick={rerun}>{rerunning ? 'Rerunning image evaluation…' : 'Rerun AI image evaluation'}</button></div>
      {evaluation.flags.length ? <><div className="finding-heading"><p className="eyebrow">Human attention required</p><h2>What LabelEvidence could not verify</h2><p>Every unresolved or conflicting requirement is shown separately. Confirm or dismiss each one.</p></div><div className="flag-list">{evaluation.flags.map((flag) => { const decision = review.flagDecisions[flag.id]; return <article className={`flag-card ${flag.kind === 'image_quality' ? 'uncertain' : ''}`} key={flag.id}><div className="flag-card-heading"><FlagIcon flag={flag}/><h3>{flag.title}</h3></div><p>{flag.detail}</p><dl className="comparison-values">{flag.applicationValue && <div><dt>Expected</dt><dd>{flag.applicationValue}</dd></div>}{flag.labelValue && <div><dt>Image evidence</dt><dd>{flag.labelValue}</dd></div>}</dl><div className="flag-actions" aria-label={`Decision for ${flag.title}`}><button className={decision === 'confirmed' ? 'selected confirm' : ''} type="button" onClick={() => decideFlag(flag.id, 'confirmed')}>Confirm concern</button><button className={decision === 'dismissed' ? 'selected dismiss' : ''} type="button" onClick={() => decideFlag(flag.id, 'dismissed')}>Dismiss concern</button></div></article>})}</div></> : <div className="clear-review-message"><span aria-hidden="true">✓</span><h2>No red flags detected</h2><p>OCR read the required image evidence and the routed comparisons identified no concern.</p></div>}
      <details className="complete-review"><summary>View complete review ({evaluation.checks.length} checks)</summary><div>{evaluation.checks.map((check) => <p key={check.id}><span className={check.status === 'confirmed' ? 'check-pass' : 'check-flag'}>{check.status === 'confirmed' ? 'Verified' : 'Review'}</span><strong>{check.label}</strong><small>{check.detail}</small></p>)}</div></details>
      <section className="final-decision-panel"><div><p className="eyebrow">Final human decision</p><h2>{review.finalDecision === 'approved' ? 'Approved' : review.finalDecision === 'returned' ? 'Returned for correction' : 'Decision required'}</h2><p>{evaluation.flags.length && !allAddressed ? 'Address every concern before making the final decision.' : confirmed ? `${confirmed} confirmed concern${confirmed === 1 ? '' : 's'} remain.` : 'No confirmed concerns remain.'}</p></div><label>Reviewer note<textarea value={review.note} onChange={(event) => onReviewChange({ ...review, note: event.target.value })} placeholder="Optional note about the decision" /></label><div className="final-decision-actions"><button className={review.finalDecision === 'approved' ? 'decision-approved' : ''} type="button" disabled={!allAddressed || confirmed > 0} onClick={() => makeFinalDecision('approved')}>Approve label</button><button className={review.finalDecision === 'returned' ? 'decision-returned' : ''} type="button" disabled={!allAddressed || confirmed === 0} onClick={() => makeFinalDecision('returned')}>Return for correction</button></div>{review.decidedAt && <small>Saved on this device · {new Date(review.decidedAt).toLocaleString()}</small>}</section></div></div>
  </section></div>
}

function SingleUnit({ item, evaluation, processing, review, onOpen }: { item: LabelEvidenceCase; evaluation?: ImageCaseEvaluation; processing?: ProcessingState; review?: StoredCaseReview; onOpen: () => void }) {
  return <section className="single-review-card"><p className="eyebrow">FIFO queue · Individual label</p><h2>{item.displayName}</h2><p>{item.category.label}</p><div className="single-status">{evaluation ? <><strong>{evaluation.flags.length ? 'Needs human review' : 'No red flags detected'}</strong><span>Image evaluated in {formatDuration(evaluation.durationMs)}</span></> : processing?.caseId === item.id ? <><strong>Reading submitted label image…</strong><span>{processing.message} · {processing.progress}%</span></> : <><strong>Waiting for image evaluation</strong><span>LabelEvidence is processing earlier applications first.</span></>}</div><button className="primary-button" type="button" disabled={!evaluation} onClick={onOpen}>{review?.finalDecision ? 'Open completed decision' : 'Open label review'}</button></section>
}

function BatchUnit({ unit, evaluations, reviews, casesById, processing, onOpen, attested, onAttested, onBulkApprove }: { unit: ReviewQueueUnit; evaluations: ImageCaseEvaluation[]; reviews: Record<string, StoredCaseReview>; casesById: Map<string, LabelEvidenceCase>; processing?: ProcessingState; onOpen: (id: string) => void; attested: boolean; onAttested: (value: boolean) => void; onBulkApprove: (ids: string[]) => void }) {
  const flagged = evaluations.filter((item) => item.flags.length), clear = evaluations.filter((item) => !item.flags.length), complete = unit.caseIds.filter((id) => reviews[id]?.finalDecision).length
  return <section className="batch-workspace"><header><div><p className="eyebrow">Recognized batch · {unit.id}</p><h2>Batch of {unit.caseIds.length} labels</h2><p>Each label still receives an individual decision. Results appear below as image evaluation finishes.</p></div><span>{complete}/{unit.caseIds.length} decisions complete</span></header>{processing && unit.caseIds.includes(processing.caseId) && <div className="batch-live-progress"><strong>Continuing background evaluation</strong><span>{casesById.get(processing.caseId)?.displayName} · {processing.message} · {processing.progress}%</span></div>}
    <section className="review-group review-group-flags"><header><div><p className="eyebrow">Start here</p><h3>Needs human review</h3></div><span>{flagged.length} ready</span></header><div className="case-table" role="table" aria-label="Batch labels needing human review">{flagged.map((evaluation) => { const item = casesById.get(evaluation.caseId)!; const review = reviews[item.id]; const addressed = evaluation.flags.filter((flag) => review?.flagDecisions[flag.id]).length; return <button className="case-row" type="button" role="row" key={item.id} onClick={() => onOpen(item.id)}><span className="case-id">{item.id}</span><span className="case-name"><strong>{item.displayName}</strong><small>{item.category.shortLabel}</small></span><span className="case-reasons">{evaluation.flags.map((flag) => flag.title).join(' · ')}</span><span className={`case-status ${review?.finalDecision ?? ''}`}>{review?.finalDecision === 'approved' ? 'Approved' : review?.finalDecision === 'returned' ? 'Returned' : `${addressed}/${evaluation.flags.length} addressed`}</span><span>›</span></button>})}</div></section>
    <section className="review-group review-group-clear"><header><div><p className="eyebrow">Review or batch approve</p><h3>No red flags detected</h3></div><span>{clear.length} ready</span></header>{clear.length > 0 && <div className="bulk-toolbar"><label><input type="checkbox" checked={attested} onChange={(event) => onAttested(event.target.checked)}/>I understand that no red flags were detected. I reviewed these labels and authorize their approval.</label><button type="button" disabled={!attested || clear.every((item) => reviews[item.caseId]?.finalDecision)} onClick={() => onBulkApprove(clear.map((item) => item.caseId))}>Approve remaining clear labels</button></div>}<div className="clear-case-grid">{clear.map((evaluation) => { const item = casesById.get(evaluation.caseId)!; const decision = reviews[item.id]?.finalDecision; return <article className={decision ? `clear-case ${decision}` : 'clear-case'} key={item.id}><button type="button" onClick={() => onOpen(item.id)}><strong>{item.displayName}</strong><small>{item.category.shortLabel} · {formatDuration(evaluation.durationMs)}</small><span>{decision === 'approved' ? 'Approved' : 'Open individual review'}</span></button></article>})}</div></section>
    {evaluations.length < unit.caseIds.length && <p className="waiting-count">{unit.caseIds.length - evaluations.length} label{unit.caseIds.length - evaluations.length === 1 ? '' : 's'} still being evaluated.</p>}
  </section>
}

function App() {
  const [welcomeVisible, setWelcomeVisible] = useState(() => window.localStorage.getItem(WELCOME_STORAGE_KEY) !== 'true')
  const [evaluations, setEvaluations] = useState<Record<string, ImageCaseEvaluation>>({})
  const [processing, setProcessing] = useState<ProcessingState | undefined>()
  const [reviews, setReviews] = useState<Record<string, StoredCaseReview>>(readStoredReviews)
  const [queueIndex, setQueueIndex] = useState(readQueuePosition)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [bulkAttested, setBulkAttested] = useState(false)
  const [demoBatch, setDemoBatch] = useState<ReviewQueueUnit | null>(null)
  const [evaluationRun, setEvaluationRun] = useState(0)
  const evaluationsRef = useRef(evaluations)
  const casesById = useMemo(() => new Map(LABEL_EVIDENCE_CASES.map((item) => [item.id, item])), [])
  const queue = useMemo(() => createReviewQueue(LABEL_EVIDENCE_CASES.map((item) => item.id), QUEUE_SEED), [])
  const currentUnit = demoBatch ?? queue[Math.min(queueIndex, queue.length - 1)]

  useEffect(() => { document.title = 'LabelEvidence · Alcohol label review' }, [])
  useEffect(() => { evaluationsRef.current = evaluations }, [evaluations])
  useEffect(() => { window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews)) }, [reviews])
  useEffect(() => { window.localStorage.setItem(QUEUE_POSITION_KEY, String(queueIndex)) }, [queueIndex])
  useEffect(() => {
    if (welcomeVisible) return
    let cancelled = false
    async function processQueue() {
      try {
        await warmOcrEngine()
      } catch (error) {
        if (!cancelled) setProcessing({ caseId: LABEL_EVIDENCE_CASES[0].id, progress: 0, message: error instanceof Error ? `Image reader could not start: ${error.message}` : 'Image reader could not start' })
        return
      }
      for (const item of LABEL_EVIDENCE_CASES) {
        if (cancelled) return
        if (evaluationsRef.current[item.id]) continue
        setProcessing({ caseId: item.id, progress: 1, message: 'Preparing required evidence questions' })
        try {
          const evaluation = await evaluateImageCase(item, (progress) => !cancelled && setProcessing({ caseId: item.id, ...progress }))
          if (!cancelled) setEvaluations((current) => ({ ...current, [item.id]: evaluation }))
        } catch (error) {
          if (!cancelled) setProcessing({ caseId: item.id, progress: 0, message: error instanceof Error ? error.message : 'Image evaluation failed' })
        }
      }
      if (!cancelled) setProcessing(undefined)
    }
    void processQueue()
    return () => { cancelled = true }
  }, [evaluationRun, welcomeVisible])

  const unitEvaluations = currentUnit.caseIds.map((id) => evaluations[id]).filter((value): value is ImageCaseEvaluation => Boolean(value))
  const unitOrder = [...unitEvaluations.filter((item) => item.flags.length), ...unitEvaluations.filter((item) => !item.flags.length)].map((item) => item.caseId)
  const selectedIndex = selectedCaseId ? unitOrder.indexOf(selectedCaseId) : -1
  const selectedCase = selectedCaseId ? casesById.get(selectedCaseId) : undefined
  const selectedEvaluation = selectedCaseId ? evaluations[selectedCaseId] : undefined
  const selectedReview = selectedCaseId ? reviews[selectedCaseId] ?? { flagDecisions: {}, note: '' } : undefined
  const unitComplete = currentUnit.caseIds.every((id) => reviews[id]?.finalDecision)
  const nextUnit = !demoBatch ? queue[queueIndex + 1] : undefined

  function enterWorkspace() { window.localStorage.setItem(WELCOME_STORAGE_KEY, 'true'); setWelcomeVisible(false) }
  function updateReview(caseId: string, review: StoredCaseReview) { setReviews((current) => ({ ...current, [caseId]: review })) }
  async function rerunEvaluation(caseId: string) { const existing = evaluations[caseId]; const item = casesById.get(caseId)!; const evaluation = await evaluateImageCase(item, (progress) => setProcessing({ caseId, ...progress })); if (existing?.imageUrl) URL.revokeObjectURL(existing.imageUrl); setEvaluations((current) => ({ ...current, [caseId]: evaluation })); setProcessing(undefined) }
  function advanceQueue() { if (demoBatch) { setDemoBatch(null); setBulkAttested(false); return } setQueueIndex((value) => Math.min(value + 1, queue.length - 1)); setBulkAttested(false); setSelectedCaseId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function goBackQueue() { if (demoBatch) { setDemoBatch(null); return } setQueueIndex((value) => Math.max(0, value - 1)); setBulkAttested(false); setSelectedCaseId(null) }
  function createFortyBatch() { setDemoBatch({ id: 'optional-batch-40', kind: 'batch', caseIds: selectBalancedCases(Date.now()).map((item) => item.id) }); setBulkAttested(false); setSelectedCaseId(null) }
  function resetData() { if (!window.confirm('Reset all evaluations, queue progress, and reviewer decisions? The About page will remain available without reopening automatically.')) return; Object.values(evaluations).forEach((item) => URL.revokeObjectURL(item.imageUrl)); window.localStorage.removeItem(REVIEW_STORAGE_KEY); window.localStorage.removeItem(QUEUE_POSITION_KEY); setReviews({}); setEvaluations({}); setQueueIndex(0); setDemoBatch(null); setSelectedCaseId(null); setBulkAttested(false); setEvaluationRun((value) => value + 1) }
  function bulkApprove(ids: string[]) { if (!bulkAttested) return; const now = new Date().toISOString(); setReviews((current) => { const next = { ...current }; ids.forEach((id) => { if (!next[id]?.finalDecision) next[id] = { flagDecisions: {}, note: 'Reviewer-attested approval from the no-red-flags batch group.', finalDecision: 'approved', decidedAt: now } }); return next }); setBulkAttested(false) }

  if (welcomeVisible) return <Welcome onContinue={enterWorkspace}/>
  const singleItem = currentUnit.kind === 'single' ? casesById.get(currentUnit.caseIds[0]) : undefined
  return <div className="app-shell"><header className="site-header"><button className="wordmark" type="button" onClick={() => setWelcomeVisible(true)}><span className="wordmark-mark">LE</span><span>LabelEvidence</span></button><nav className="site-nav"><button type="button" onClick={() => setWelcomeVisible(true)}>Return to About LabelEvidence</button><button type="button" onClick={createFortyBatch}>Optional batch of 40</button><button type="button" onClick={resetData}>Reset all data</button></nav></header>
    <main className="workspace-main"><section className="workspace-heading"><div><p className="eyebrow">First-in, first-out review</p><h1>{demoBatch ? 'Optional batch demonstration' : `Queue item ${queueIndex + 1} of ${queue.length}`}</h1><p>{demoBatch ? 'This optional 40-label demonstration does not change the normal FIFO queue.' : currentUnit.kind === 'single' ? 'This application is reviewed in its received order as an individual label.' : `The queue identified a batch containing ${currentUnit.caseIds.length} labels.`}</p></div><div className="workspace-actions"><button className="secondary-button" type="button" disabled={!demoBatch && queueIndex === 0} onClick={goBackQueue}>Back in queue</button></div></section>
      {!demoBatch && nextUnit?.kind === 'batch' && <aside className="next-batch-notice"><strong>A batch of {nextUnit.caseIds.length} labels is next in the queue.</strong><span>LabelEvidence will categorize its results as processing completes, while preserving an individual decision for every label.</span></aside>}
      {singleItem ? <SingleUnit item={singleItem} evaluation={evaluations[singleItem.id]} processing={processing} review={reviews[singleItem.id]} onOpen={() => setSelectedCaseId(singleItem.id)}/> : <BatchUnit unit={currentUnit} evaluations={unitEvaluations} reviews={reviews} casesById={casesById} processing={processing} onOpen={setSelectedCaseId} attested={bulkAttested} onAttested={setBulkAttested} onBulkApprove={bulkApprove}/>}
      {unitComplete && <section className="unit-complete"><p className="eyebrow">{currentUnit.kind === 'batch' ? 'Batch complete' : 'Review complete'}</p><h2>{currentUnit.kind === 'batch' ? `All ${currentUnit.caseIds.length} labels have human decisions.` : 'This label has a human decision.'}</h2><button className="primary-button" type="button" onClick={advanceQueue}>{demoBatch ? 'Return to FIFO queue' : queueIndex < queue.length - 1 ? 'Continue to next queue item' : 'Queue complete'}</button></section>}
    </main>
    {selectedCase && selectedEvaluation && selectedReview && <CaseDetail key={selectedCase.id} item={selectedCase} evaluation={selectedEvaluation} review={selectedReview} onReviewChange={(review) => updateReview(selectedCase.id, review)} onClose={() => setSelectedCaseId(null)} onPrevious={() => setSelectedCaseId(unitOrder[selectedIndex - 1])} onNext={() => setSelectedCaseId(unitOrder[selectedIndex + 1])} hasPrevious={selectedIndex > 0} hasNext={selectedIndex >= 0 && selectedIndex < unitOrder.length - 1} onRerun={() => rerunEvaluation(selectedCase.id)}/>}
  </div>
}

export default App
