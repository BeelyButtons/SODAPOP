import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { selectBalancedCases } from './labelEvidence/batch'
import { LABEL_EVIDENCE_CASES, ROUTING_CATEGORIES } from './labelEvidence/cases'
import { evaluateImageCase, type ImageCaseEvaluation } from './labelEvidence/imageEvaluation'
import { createRandomizedReviewQueue, type ReviewQueueUnit } from './labelEvidence/reviewQueue'
import type { LabelEvidenceCase, ReviewCheckResult, ReviewFlag } from './labelEvidence/types'
import { warmOcrEngine, type OcrProgress } from './ocr/recognizeLabel'

type FlagDecision = 'confirmed' | 'dismissed'
type FinalDecision = 'approved' | 'returned'
type Route = { page: 'about' | 'queue' | 'review' | 'batch'; caseId?: string }

interface StoredCaseReview {
  flagDecisions: Record<string, FlagDecision>
  checkDisagreements: Record<string, boolean>
  draftDecision?: FinalDecision
  finalDecision?: FinalDecision
  note: string
  decidedAt?: string
}

interface ProcessingState extends OcrProgress { caseId: string }

const REVIEW_STORAGE_KEY = 'labelevidence.reviewer-decisions.v3'
const LEGACY_REVIEW_STORAGE_KEY = 'labelevidence.reviewer-decisions.v2'
const QUEUE_SEED_KEY = 'labelevidence.randomized-queue-seed.v1'
const ANALYSIS_STARTED_KEY = 'labelevidence.analysis-started.v1'
const RESUME_CASE_KEY = 'labelevidence.resume-case.v1'
const BATCH_NOTICES_KEY = 'labelevidence.batch-notices.v1'

function emptyReview(): StoredCaseReview {
  return { flagDecisions: {}, checkDisagreements: {}, note: '' }
}

function readStoredReviews(): Record<string, StoredCaseReview> {
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_REVIEW_STORAGE_KEY) ?? '{}'
    const saved = JSON.parse(raw) as Record<string, Partial<StoredCaseReview>>
    return Object.fromEntries(Object.entries(saved).map(([id, review]) => [id, {
      ...emptyReview(),
      ...review,
      flagDecisions: review.flagDecisions ?? {},
      checkDisagreements: review.checkDisagreements ?? {},
    }]))
  } catch { return {} }
}

function readQueueSeed() {
  const stored = Number(window.localStorage.getItem(QUEUE_SEED_KEY))
  return Number.isFinite(stored) && stored > 0 ? stored : null
}

function newQueueSeed() {
  const values = new Uint32Array(1)
  globalThis.crypto?.getRandomValues?.(values)
  return values[0] || Math.max(1, Math.floor(Math.random() * 0xffffffff))
}

function readBatchNotices() {
  try { return new Set<string>(JSON.parse(window.localStorage.getItem(BATCH_NOTICES_KEY) ?? '[]')) } catch { return new Set<string>() }
}

function routeFromPath(pathname: string): Route {
  const review = pathname.match(/^\/review\/([^/]+)$/)
  if (review) return { page: 'review', caseId: decodeURIComponent(review[1]) }
  if (pathname.startsWith('/queue')) return { page: 'queue' }
  if (pathname.startsWith('/batch')) return { page: 'batch' }
  return { page: 'about' }
}

function formatDuration(milliseconds: number) {
  return milliseconds < 1000 ? `${Math.max(1, Math.round(milliseconds))} ms` : `${(milliseconds / 1000).toFixed(2)} seconds`
}

function FlagIcon({ flag }: { flag: ReviewFlag }) {
  const label = flag.kind === 'image_quality' ? 'Could not verify' : flag.kind.includes('claim') ? 'Claim' : flag.kind === 'evidence' ? 'Evidence' : 'Possible conflict'
  return <span className={`flag-kind flag-kind-${flag.kind}`}>{label}</span>
}

function Welcome({ onContinue }: { onContinue: () => void }) {
  return <main className="welcome-page">
    <div className="welcome-sticky-action"><button className="primary-button" type="button" onClick={onContinue}>Go to LabelEvidence</button></div>
    <section className="welcome-hero"><p className="eyebrow">LabelEvidence prototype</p><h1>Evidence-led alcohol label review, built around the human decision.</h1><p>The application selects the rules. The rules define what must be found. OCR reads the submitted label image. Every required item that cannot be verified—or appears inconsistent—becomes its own human-review concern.</p><button className="primary-button" type="button" onClick={onContinue}>Go to LabelEvidence</button></section>
    <section className="welcome-explainer" aria-label="What this demonstration shows"><article><span>01</span><h2>Build the review questions</h2><p>Application and evidence facts route every product into the requirements that apply to it.</p></article><article><span>02</span><h2>Read the actual image</h2><p>Local OCR examines label pixels in the saved queue order after the reviewer starts analysis.</p></article><article><span>03</span><h2>Keep the human in control</h2><p>Reviewers see the evidence, challenge AI conclusions, and explicitly confirm every final decision.</p></article></section>
    <section className="welcome-coverage"><div><p className="eyebrow">Demonstration coverage</p><h2>56 image-and-application cases across eight review profiles</h2></div><div className="welcome-profile-grid">{ROUTING_CATEGORIES.map((category) => <p key={category.id}>{category.label}<small>7 cases</small></p>)}</div></section>
    <p className="prototype-note"><strong>Prototype boundary:</strong> The OCR and rules engine run locally in the browser. This demonstration does not connect to TTB systems or make autonomous regulatory decisions.</p>
  </main>
}

function LabelImage({ evaluation, rotation, brightness, contrast, zoom }: { evaluation: ImageCaseEvaluation; rotation: number; brightness: number; contrast: number; zoom: number }) {
  return <div className="label-artwork-viewport"><img className="submitted-label-image" src={evaluation.imageUrl} alt="Submitted label evidence" style={{ transform: `rotate(${rotation}deg) scale(${zoom / 100})`, filter: `brightness(${brightness}%) contrast(${contrast}%)` }} /></div>
}

function CompleteReviewRow({ check, disagreed, finalized, onToggle }: { check: ReviewCheckResult; disagreed: boolean; finalized: boolean; onToggle: () => void }) {
  const aiConcern = check.status === 'flagged'
  return <article className={disagreed ? 'complete-check human-disagreement' : 'complete-check'}>
    <span className={aiConcern ? 'check-flag' : disagreed ? 'check-disagree' : 'check-pass'}>{aiConcern ? 'Review' : disagreed ? 'Disagree' : 'Verified'}</span>
    <strong>{check.label}</strong>
    <div className="check-evidence"><p><b>Expected</b><span>{check.expected || 'No separate application value required.'}</span></p><p><b>Image evidence</b><span>{check.observed || 'No readable image evidence recorded.'}</span></p><small>{check.detail}</small></div>
    <div className="check-action">{aiConcern ? <span>Concern shown above</span> : <button type="button" disabled={finalized} className={disagreed ? 'selected' : ''} onClick={onToggle}>{disagreed ? 'Undo disagreement' : 'Disagree'}</button>}</div>
  </article>
}

function CaseDetail({ item, evaluation, review, onReviewChange, onClose, onConfirmAndProceed, onRerun }: {
  item: LabelEvidenceCase
  evaluation: ImageCaseEvaluation
  review: StoredCaseReview
  onReviewChange: (review: StoredCaseReview) => void
  onClose: () => void
  onConfirmAndProceed: (review: StoredCaseReview) => void
  onRerun: () => Promise<void>
}) {
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [zoom, setZoom] = useState(100)
  const [rerunning, setRerunning] = useState(false)
  const finalized = Boolean(review.finalDecision)
  const addressed = evaluation.flags.filter((flag) => review.flagDecisions[flag.id]).length
  const allAddressed = addressed === evaluation.flags.length
  const confirmed = evaluation.flags.filter((flag) => review.flagDecisions[flag.id] === 'confirmed').length
  const disagreements = Object.values(review.checkDisagreements).filter(Boolean).length
  const returnNeedsNote = review.draftDecision === 'returned' && confirmed === 0 && disagreements === 0
  const canConfirm = Boolean(review.draftDecision && allAddressed && (!returnNeedsNote || review.note.trim()))

  function changeReview(patch: Partial<StoredCaseReview>) {
    onReviewChange({ ...review, ...patch })
  }
  function decideFlag(flagId: string, decision: FlagDecision) {
    if (finalized) return
    changeReview({ draftDecision: undefined, flagDecisions: { ...review.flagDecisions, [flagId]: decision } })
  }
  function toggleDisagreement(checkId: string) {
    if (finalized) return
    changeReview({ draftDecision: undefined, checkDisagreements: { ...review.checkDisagreements, [checkId]: !review.checkDisagreements[checkId] } })
  }
  function selectDecision(decision: FinalDecision) {
    if (finalized || !allAddressed || (decision === 'approved' && (confirmed > 0 || disagreements > 0))) return
    changeReview({ draftDecision: decision })
  }
  function beginAmendment() {
    changeReview({ draftDecision: review.finalDecision, finalDecision: undefined, decidedAt: undefined })
  }
  function resetImage() { setRotation(0); setBrightness(100); setContrast(100); setZoom(100) }
  async function rerun() { setRerunning(true); try { await onRerun() } finally { setRerunning(false) } }

  return <div className="detail-backdrop" role="presentation"><section className="case-detail" role="dialog" aria-modal="true" aria-labelledby="case-detail-title">
    <header><div className="detail-navigation"><button type="button" onClick={onClose}>← Review queue</button><div><p className="eyebrow">{item.id} · {item.category.label}</p><h1 id="case-detail-title">{item.displayName}</h1><p>{evaluation.flags.length ? `${addressed} of ${evaluation.flags.length} concerns addressed` : 'No AI concerns'} · Total {formatDuration(evaluation.durationMs)}</p></div></div><button className="icon-button" type="button" onClick={onClose} aria-label="Exit human review">×</button></header>
    <div className="case-detail-grid"><div className="artwork-column"><div className="artwork-tools-heading"><span>Submitted label image</span><details><summary>Edit / enhance image</summary><div className="image-tools"><label>Zoom <input type="range" min="75" max="150" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><label>Brightness <input type="range" min="60" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label><label>Contrast <input type="range" min="60" max="160" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label><div><button type="button" onClick={() => setRotation((value) => value - 90)}>Rotate left</button><button type="button" onClick={() => setRotation((value) => value + 90)}>Rotate right</button><button type="button" onClick={resetImage}>Reset image</button></div><small>Viewing adjustments do not replace or alter the submitted evidence.</small></div></details></div><LabelImage evaluation={evaluation} rotation={rotation} brightness={brightness} contrast={contrast} zoom={zoom} /><details className="application-details"><summary>Application and evidence</summary><dl><div><dt>Brand</dt><dd>{item.application.brandName}</dd></div><div><dt>Class/type</dt><dd>{item.application.classType}</dd></div><div><dt>Alcohol</dt><dd>{item.application.alcoholContent}</dd></div><div><dt>Net contents</dt><dd>{item.application.netContents}</dd></div><div><dt>Responsible party</dt><dd>{item.application.responsibleParty}</dd></div><div><dt>Source</dt><dd>{item.application.source === 'imported' ? `Imported · ${item.application.countryOrigin ?? 'origin not supplied'}` : 'Domestic'}</dd></div><div><dt>Formula</dt><dd>{item.application.formula.required ? item.application.formula.id ?? 'Required; record unavailable' : 'Not required in case record'}</dd></div></dl></details></div>
      <div className="finding-column"><div className="evaluation-metrics"><span><strong>{Math.round(evaluation.ocrConfidence)}%</strong> OCR confidence</span><span><strong>{formatDuration(evaluation.outcome.durationMs)}</strong> image reading</span><span><strong>{formatDuration(evaluation.rulesDurationMs)}</strong> rules comparison</span></div><div className="rerun-row"><button type="button" disabled={rerunning || finalized} onClick={rerun}>{rerunning ? 'Rerunning image evaluation…' : 'Rerun AI image evaluation'}</button></div>
      {evaluation.flags.length ? <><div className="finding-heading"><p className="eyebrow">Human attention required</p><h2>What LabelEvidence could not resolve</h2><p>Every unresolved or conflicting requirement is shown separately. Confirm or dismiss each one.</p></div><div className="flag-list">{evaluation.flags.map((flag) => { const decision = review.flagDecisions[flag.id]; return <article className={`flag-card ${flag.kind === 'image_quality' ? 'uncertain' : ''}`} key={flag.id}><div className="flag-card-heading"><FlagIcon flag={flag}/><h3>{flag.title}</h3></div><p>{flag.detail}</p><dl className="comparison-values">{flag.applicationValue && <div><dt>Expected</dt><dd>{flag.applicationValue}</dd></div>}{flag.labelValue && <div><dt>Image evidence</dt><dd>{flag.labelValue}</dd></div>}</dl><div className="flag-actions" aria-label={`Decision for ${flag.title}`}><button disabled={finalized} className={decision === 'confirmed' ? 'selected confirm' : ''} type="button" onClick={() => decideFlag(flag.id, 'confirmed')}>Confirm concern</button><button disabled={finalized} className={decision === 'dismissed' ? 'selected dismiss' : ''} type="button" onClick={() => decideFlag(flag.id, 'dismissed')}>Dismiss concern</button></div></article>})}</div></> : <div className="clear-review-message"><span aria-hidden="true">✓</span><h2>No AI concerns detected</h2><p>The complete review below still shows every comparison and allows the reviewer to disagree.</p></div>}
      <details className="complete-review" open={!evaluation.flags.length}><summary>View complete review ({evaluation.checks.length} checks)</summary><div className="complete-review-head"><span>AI result</span><span>Requirement checked</span><span>Expected and image evidence</span><span>Human review</span></div><div>{evaluation.checks.map((check) => <CompleteReviewRow key={check.id} check={check} disagreed={Boolean(review.checkDisagreements[check.id])} finalized={finalized} onToggle={() => toggleDisagreement(check.id)} />)}</div></details>
      <section className="final-decision-panel"><div><p className="eyebrow">Final human decision</p><h2>{review.finalDecision === 'approved' ? 'Approved' : review.finalDecision === 'returned' ? 'Returned for correction' : review.draftDecision === 'approved' ? 'Draft: approve label' : review.draftDecision === 'returned' ? 'Draft: return for correction' : 'Decision required'}</h2><p>{finalized ? 'This saved decision can be amended.' : !allAddressed ? 'Address every AI concern before selecting a decision.' : confirmed || disagreements ? `${confirmed} confirmed AI concern${confirmed === 1 ? '' : 's'} and ${disagreements} human disagreement${disagreements === 1 ? '' : 's'} prevent approval.` : 'The reviewer may approve the label or return it for a concern the AI did not identify.'}</p></div><label>Reviewer note<textarea disabled={finalized} value={review.note} onChange={(event) => changeReview({ note: event.target.value })} placeholder={returnNeedsNote ? 'Explain the correction the AI did not identify' : 'Optional note about the decision'} /></label>{finalized ? <div className="saved-decision-actions"><small>Saved on this device · {review.decidedAt ? new Date(review.decidedAt).toLocaleString() : 'date unavailable'}</small><button type="button" onClick={beginAmendment}>Change saved decision</button></div> : <><div className="final-decision-actions"><button className={review.draftDecision === 'approved' ? 'decision-approved' : ''} type="button" disabled={!allAddressed || confirmed > 0 || disagreements > 0} onClick={() => selectDecision('approved')}>Approve label</button><button className={review.draftDecision === 'returned' ? 'decision-returned' : ''} type="button" disabled={!allAddressed} onClick={() => selectDecision('returned')}>Return for correction</button>{review.draftDecision && <button className="confirm-proceed" type="button" disabled={!canConfirm} onClick={() => onConfirmAndProceed(review)}>Confirm and proceed to next label →</button>}</div>{returnNeedsNote && !review.note.trim() && <small className="decision-help">Add a short note explaining what needs correction, then confirm the decision.</small>}</>}</section></div></div>
  </section></div>
}

function QueueRow({ item, evaluation, processing, error, review, position, onOpen }: { item: LabelEvidenceCase; evaluation?: ImageCaseEvaluation; processing?: ProcessingState; error?: string; review?: StoredCaseReview; position: number; onOpen: () => void }) {
  const aiStatus = processing?.caseId === item.id
    ? <><strong>AI evaluating image…</strong><small>{processing.message} · {processing.progress}%</small></>
    : evaluation
      ? <><strong>Evaluated by AI in {formatDuration(evaluation.durationMs)}</strong><small>{evaluation.flags.length ? `${evaluation.flags.length} item${evaluation.flags.length === 1 ? '' : 's'} need human review` : 'No AI concerns detected'}</small></>
      : error
        ? <><strong>AI evaluation stopped</strong><small>{error}</small></>
        : <><strong>Not yet evaluated by AI</strong><small>Waiting in saved queue order</small></>
  const humanStatus = review?.finalDecision === 'approved' ? 'Approved' : review?.finalDecision === 'returned' ? 'Returned for correction' : review?.draftDecision ? 'Draft decision saved' : evaluation ? 'Ready for human review' : 'Waiting for AI'
  return <div className="library-row" role="row"><span className="queue-position">{position}</span><span className="case-name"><strong>{item.displayName}</strong><small>{item.id} · {item.category.shortLabel}</small></span><span className="ai-row-status">{aiStatus}</span><span className={`human-row-status ${review?.finalDecision ?? ''}`}>{humanStatus}</span><button type="button" disabled={!evaluation} onClick={onOpen}>{review?.finalDecision ? 'Open decision' : review?.draftDecision ? 'Resume review' : 'Review label'}</button></div>
}

function QueueDashboard({ units, casesById, evaluations, processing, errors, reviews, analysisStarted, onStartAnalysis, onOpen, onStartHumanReview, bulkAttested, onBulkAttested, onBulkApprove, title = 'Label review queue', description = 'AI evaluates applications in this saved order. Human review may begin as soon as the first result is ready.' }: {
  units: ReviewQueueUnit[]
  casesById: Map<string, LabelEvidenceCase>
  evaluations: Record<string, ImageCaseEvaluation>
  processing?: ProcessingState
  errors: Record<string, string>
  reviews: Record<string, StoredCaseReview>
  analysisStarted: boolean
  onStartAnalysis: () => void
  onOpen: (id: string) => void
  onStartHumanReview: () => void
  bulkAttested: Record<string, boolean>
  onBulkAttested: (id: string, value: boolean) => void
  onBulkApprove: (ids: string[]) => void
  title?: string
  description?: string
}) {
  const orderedIds = units.flatMap((unit) => unit.caseIds)
  const evaluatedCount = orderedIds.filter((id) => evaluations[id]).length
  const completedCount = orderedIds.filter((id) => reviews[id]?.finalDecision).length
  const readyCount = orderedIds.filter((id) => evaluations[id] && !reviews[id]?.finalDecision).length
  let position = 0
  return <main className="queue-page"><section className="queue-heading"><div><p className="eyebrow">First-in, first-out review</p><h1>{title}</h1><p>{description}</p></div><div className="queue-summary"><span><strong>{orderedIds.length}</strong>Total labels</span><span><strong>{evaluatedCount}</strong>AI evaluated</span><span><strong>{readyCount}</strong>Ready for human</span><span><strong>{completedCount}</strong>Human decisions</span></div></section>
    <section className="analysis-command"><div>{!analysisStarted ? <><h2>AI analysis has not started</h2><p>Every row will remain untouched until you begin. OCR, image analysis, and routed rule checks will then run in the saved order.</p></> : processing ? <><h2>AI analysis is continuing in the background</h2><p>{casesById.get(processing.caseId)?.displayName} · {processing.message} · {processing.progress}%</p></> : evaluatedCount === orderedIds.length ? <><h2>AI analysis complete</h2><p>All {orderedIds.length} labels have image-and-rule results.</p></> : <><h2>AI analysis is preparing</h2><p>The local image reader is starting.</p></>}</div><div><button className="primary-button" type="button" disabled={analysisStarted} onClick={onStartAnalysis}>{analysisStarted ? 'AI analysis started' : 'Begin AI analysis'}</button><button className="secondary-button" type="button" disabled={!readyCount} onClick={onStartHumanReview}>{readyCount ? 'Begin or resume human review' : 'Human review waiting for AI'}</button></div></section>
    <section className="queue-library" aria-label="Label review library">{units.map((unit, unitIndex) => {
      const clearReady = unit.kind === 'batch' ? unit.caseIds.filter((id) => evaluations[id] && !evaluations[id].flags.length && !reviews[id]?.finalDecision) : []
      return <section className={`queue-unit ${unit.kind}`} key={unit.id}><header><div><p className="eyebrow">Queue unit {unitIndex + 1}</p><h2>{unit.kind === 'batch' ? `Batch of ${unit.caseIds.length} labels` : 'Individual label'}</h2></div><span>{unit.kind === 'batch' ? 'Batch detected' : 'Single application'}</span></header><div className="library-table" role="table" aria-label={`${unit.kind === 'batch' ? 'Batch' : 'Individual'} queue unit`}><div className="library-table-head" role="row"><span>Order</span><span>Application</span><span>AI analysis</span><span>Human decision</span><span>Action</span></div>{unit.caseIds.map((id) => { position += 1; const item = casesById.get(id)!; return <QueueRow key={id} item={item} evaluation={evaluations[id]} processing={processing} error={errors[id]} review={reviews[id]} position={position} onOpen={() => onOpen(id)} /> })}</div>{clearReady.length > 0 && <div className="batch-approval"><label><input type="checkbox" checked={Boolean(bulkAttested[unit.id])} onChange={(event) => onBulkAttested(unit.id, event.target.checked)} />I understand that LabelEvidence detected no red flags for these {clearReady.length} labels. I reviewed them and authorize their approval.</label><button type="button" disabled={!bulkAttested[unit.id]} onClick={() => onBulkApprove(clearReady)}>Approve these clear labels</button></div>}</section>
    })}</section>
  </main>
}

function BatchNotice({ unit, onClose }: { unit: ReviewQueueUnit; onClose: () => void }) {
  return <div className="notice-backdrop"><section className="batch-notice" role="dialog" aria-modal="true" aria-labelledby="batch-notice-title"><p className="eyebrow">Batch detected</p><h2 id="batch-notice-title">LabelEvidence found a batch of {unit.caseIds.length} labels.</h2><p>The prototype will keep each label’s review and final decision separate while allowing clear labels to be approved together.</p><p>Additional information from the stakeholder about how real batches are identified and submitted would let us improve this workflow further.</p><button className="primary-button" type="button" onClick={onClose}>Continue</button></section></div>
}

function App() {
  const [pathname, setPathname] = useState(window.location.pathname)
  const route = routeFromPath(pathname)
  const [queueSeed, setQueueSeed] = useState<number | null>(readQueueSeed)
  const [analysisStarted, setAnalysisStarted] = useState(() => window.localStorage.getItem(ANALYSIS_STARTED_KEY) === 'true')
  const [evaluations, setEvaluations] = useState<Record<string, ImageCaseEvaluation>>({})
  const [processing, setProcessing] = useState<ProcessingState | undefined>()
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({})
  const [reviews, setReviews] = useState<Record<string, StoredCaseReview>>(readStoredReviews)
  const [bulkAttested, setBulkAttested] = useState<Record<string, boolean>>({})
  const [batchNotices, setBatchNotices] = useState<ReviewQueueUnit[]>([])
  const [shownBatchNotices, setShownBatchNotices] = useState<Set<string>>(readBatchNotices)
  const [evaluationRun, setEvaluationRun] = useState(0)
  const evaluationsRef = useRef(evaluations)
  const shownBatchNoticesRef = useRef(shownBatchNotices)
  const casesById = useMemo(() => new Map(LABEL_EVIDENCE_CASES.map((item) => [item.id, item])), [])
  const queue = useMemo(() => queueSeed === null ? [] : createRandomizedReviewQueue(LABEL_EVIDENCE_CASES.map((item) => item.id), queueSeed), [queueSeed])
  const queueOrder = useMemo(() => queue.flatMap((unit) => unit.caseIds), [queue])
  const optionalBatch = useMemo<ReviewQueueUnit | null>(() => queueSeed === null ? null : ({ id: 'optional-batch-40', kind: 'batch', caseIds: selectBalancedCases(queueSeed ^ 0x13579bdf).map((item) => item.id) }), [queueSeed])

  function navigate(path: string, replace = false) {
    if (replace) window.history.replaceState({}, '', path)
    else window.history.pushState({}, '', path)
    setPathname(path)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function ensureQueue() {
    if (queueSeed !== null) return queueSeed
    const seed = newQueueSeed()
    window.localStorage.setItem(QUEUE_SEED_KEY, String(seed))
    setQueueSeed(seed)
    return seed
  }

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => { document.title = route.page === 'about' ? 'About LabelEvidence' : route.page === 'review' ? `Review ${route.caseId} · LabelEvidence` : 'LabelEvidence · Review queue' }, [route.caseId, route.page])
  useEffect(() => { evaluationsRef.current = evaluations }, [evaluations])
  useEffect(() => { shownBatchNoticesRef.current = shownBatchNotices }, [shownBatchNotices])
  useEffect(() => { window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews)) }, [reviews])
  useEffect(() => {
    if ((route.page === 'queue' || route.page === 'review' || route.page === 'batch') && queueSeed === null) {
      const seed = newQueueSeed()
      window.localStorage.setItem(QUEUE_SEED_KEY, String(seed))
      setQueueSeed(seed)
    }
  }, [queueSeed, route.page])
  useEffect(() => {
    if (!analysisStarted || !queue.length) return
    let cancelled = false
    async function processQueue() {
      try { await warmOcrEngine() } catch (error) {
        if (!cancelled) setAnalysisErrors((current) => ({ ...current, engine: error instanceof Error ? error.message : 'The image reader could not start.' }))
        return
      }
      for (const unit of queue) {
        if (cancelled) return
        if (unit.kind === 'batch' && shownBatchNoticesRef.current.size === 0) {
          setShownBatchNotices((current) => {
            const next = new Set(current).add(unit.id)
            shownBatchNoticesRef.current = next
            window.localStorage.setItem(BATCH_NOTICES_KEY, JSON.stringify([...next]))
            return next
          })
          setBatchNotices((current) => [...current, unit])
        }
        for (const caseId of unit.caseIds) {
          if (cancelled) return
          if (evaluationsRef.current[caseId]) continue
          const item = casesById.get(caseId)!
          setProcessing({ caseId, progress: 1, message: 'Preparing required evidence questions' })
          try {
            const evaluation = await evaluateImageCase(item, (progress) => !cancelled && setProcessing({ caseId, ...progress }))
            if (!cancelled) {
              evaluationsRef.current = { ...evaluationsRef.current, [caseId]: evaluation }
              setEvaluations(evaluationsRef.current)
              setAnalysisErrors((current) => { const next = { ...current }; delete next[caseId]; return next })
            }
          } catch (error) {
            if (!cancelled) setAnalysisErrors((current) => ({ ...current, [caseId]: error instanceof Error ? error.message : 'Image evaluation failed.' }))
          }
        }
      }
      if (!cancelled) setProcessing(undefined)
    }
    void processQueue()
    return () => { cancelled = true }
  }, [analysisStarted, casesById, evaluationRun, queue])

  function enterWorkspace() { ensureQueue(); navigate('/queue') }
  function startAnalysis() { ensureQueue(); window.localStorage.setItem(ANALYSIS_STARTED_KEY, 'true'); setAnalysisStarted(true) }
  function openReview(caseId: string) { window.localStorage.setItem(RESUME_CASE_KEY, caseId); navigate(`/review/${encodeURIComponent(caseId)}`) }
  function updateReview(caseId: string, review: StoredCaseReview) { setReviews((current) => ({ ...current, [caseId]: review })) }
  function startHumanReview() {
    const resume = window.localStorage.getItem(RESUME_CASE_KEY)
    const candidate = resume && evaluations[resume] && !reviews[resume]?.finalDecision ? resume : queueOrder.find((id) => evaluations[id] && !reviews[id]?.finalDecision)
    if (candidate) openReview(candidate)
  }
  function confirmAndProceed(caseId: string, review: StoredCaseReview) {
    if (!review.draftDecision) return
    const finalized: StoredCaseReview = { ...review, finalDecision: review.draftDecision, decidedAt: new Date().toISOString() }
    const nextReviews = { ...reviews, [caseId]: finalized }
    setReviews(nextReviews)
    const currentIndex = queueOrder.indexOf(caseId)
    const next = [...queueOrder.slice(currentIndex + 1), ...queueOrder.slice(0, currentIndex)].find((id) => evaluations[id] && !nextReviews[id]?.finalDecision)
    if (next) openReview(next)
    else { window.localStorage.removeItem(RESUME_CASE_KEY); navigate('/queue') }
  }
  async function rerunEvaluation(caseId: string) {
    const existing = evaluations[caseId]
    const evaluation = await evaluateImageCase(casesById.get(caseId)!, (progress) => setProcessing({ caseId, ...progress }))
    if (existing?.imageUrl) URL.revokeObjectURL(existing.imageUrl)
    evaluationsRef.current = { ...evaluationsRef.current, [caseId]: evaluation }
    setEvaluations(evaluationsRef.current)
    setProcessing(undefined)
  }
  function bulkApprove(ids: string[]) {
    const now = new Date().toISOString()
    setReviews((current) => {
      const next = { ...current }
      ids.forEach((id) => { if (!next[id]?.finalDecision) next[id] = { ...emptyReview(), note: 'Reviewer-attested approval from the no-red-flags batch group.', draftDecision: 'approved', finalDecision: 'approved', decidedAt: now } })
      return next
    })
    setBulkAttested({})
  }
  function resetData() {
    if (!window.confirm('Reset the saved queue order, AI results, human decisions, and batch notices?')) return
    Object.values(evaluations).forEach((evaluation) => URL.revokeObjectURL(evaluation.imageUrl))
    const seed = newQueueSeed()
    window.localStorage.setItem(QUEUE_SEED_KEY, String(seed))
    ;[REVIEW_STORAGE_KEY, LEGACY_REVIEW_STORAGE_KEY, ANALYSIS_STARTED_KEY, RESUME_CASE_KEY, BATCH_NOTICES_KEY].forEach((key) => window.localStorage.removeItem(key))
    setQueueSeed(seed)
    setAnalysisStarted(false)
    setEvaluations({})
    evaluationsRef.current = {}
    setProcessing(undefined)
    setAnalysisErrors({})
    setReviews({})
    setShownBatchNotices(new Set())
    setBatchNotices([])
    setBulkAttested({})
    setEvaluationRun((value) => value + 1)
    navigate('/queue', true)
  }

  const selectedItem = route.caseId ? casesById.get(route.caseId) : undefined
  const selectedEvaluation = route.caseId ? evaluations[route.caseId] : undefined
  const selectedReview = route.caseId ? reviews[route.caseId] ?? emptyReview() : undefined
  const dashboardUnits = route.page === 'batch' && optionalBatch ? [optionalBatch] : queue

  return <div className="app-shell">{route.page !== 'about' && <header className="site-header"><button className="wordmark" type="button" onClick={() => navigate('/about')}><span className="wordmark-mark">LE</span><span>LabelEvidence</span></button><nav className="site-nav"><button type="button" onClick={() => navigate('/about')}>About LabelEvidence</button><button type="button" onClick={() => { ensureQueue(); navigate('/queue') }}>Review queue</button><button type="button" onClick={() => { ensureQueue(); navigate('/batch/optional-batch-40') }}>Optional batch of 40</button><button type="button" onClick={resetData}>Reset all data</button></nav></header>}
    {route.page === 'about' ? <Welcome onContinue={enterWorkspace} /> : <QueueDashboard units={dashboardUnits} casesById={casesById} evaluations={evaluations} processing={processing} errors={analysisErrors} reviews={reviews} analysisStarted={analysisStarted} onStartAnalysis={startAnalysis} onOpen={openReview} onStartHumanReview={startHumanReview} bulkAttested={bulkAttested} onBulkAttested={(id, value) => setBulkAttested((current) => ({ ...current, [id]: value }))} onBulkApprove={bulkApprove} title={route.page === 'batch' ? 'Optional batch demonstration' : undefined} description={route.page === 'batch' ? 'This category-balanced 40-label view does not change the saved main queue order.' : undefined} />}
    {route.page === 'review' && selectedItem && selectedEvaluation && selectedReview && <CaseDetail item={selectedItem} evaluation={selectedEvaluation} review={selectedReview} onReviewChange={(review) => updateReview(selectedItem.id, review)} onClose={() => navigate('/queue')} onConfirmAndProceed={(review) => confirmAndProceed(selectedItem.id, review)} onRerun={() => rerunEvaluation(selectedItem.id)} />}
    {route.page === 'review' && (!selectedItem || !selectedEvaluation) && <aside className="route-message"><strong>This label is not ready for human review yet.</strong><button type="button" onClick={() => navigate('/queue')}>Return to queue</button></aside>}
    {batchNotices[0] && <BatchNotice unit={batchNotices[0]} onClose={() => setBatchNotices((current) => current.slice(1))} />}
  </div>
}

export default App
