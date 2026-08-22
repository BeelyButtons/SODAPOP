import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { RuleSetControl } from './RuleSetControl'
import { reviewContextFromApplication, selectAutomaticRuleSet } from '../domain/ruleEngine'
import { buildReviewSections, type ReviewSection } from '../domain/reviewSections'
import type { ApplicationData, CheckStatus, ReviewCheck, ReviewOutcome } from '../domain/reviewSchema'
import type { QueueDecision, SavedRotation, StaffDecisions } from '../reviewQueue'

const statusLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  mismatch: 'Mismatch',
  needs_review: 'Human review',
}

const statusPriority: Record<CheckStatus, number> = { mismatch: 0, needs_review: 1, pass: 2 }
const MIN_ZOOM = 50
const MAX_ZOOM = 200
const ZOOM_STEP = 10

function requirementsFor(check: ReviewCheck) {
  if (check.requirements?.length) return check.requirements
  if (check.id !== 'warningFormat') return undefined

  const minimumTypeSize = check.expected.match(/at least ([\d.]+) mm/i)?.[1]
  const maximumDensity = check.expected.match(/no more than ([\d.]+) characters per inch/i)?.[1]
  return [
    '“GOVERNMENT WARNING” is uppercase and bold',
    'Text following the heading is not bold',
    minimumTypeSize ? `Minimum type size: ${minimumTypeSize} mm` : 'Confirm the applicable minimum type size',
    maximumDensity ? `Maximum density: ${maximumDensity} characters per inch` : 'Confirm the applicable maximum character density',
    'Text contrasts with its background',
    'Warning is separated from other information',
  ]
}

type Props = {
  result: ReviewOutcome
  previewUrl: string
  fileName: string
  readOnly?: boolean
  initialDecisions?: StaffDecisions
  initialRotation?: SavedRotation
  recordedDecision?: QueueDecision
  amendmentCheckId?: ReviewCheck['id']
  onFinalDecision?: (decision: QueueDecision, decisions: StaffDecisions, rotation: SavedRotation) => void
  onPause?: () => void
  pauseLabel?: string
  onChangeDecision?: (id: ReviewCheck['id']) => void
  pageContext?: {
    eyebrow: string
    title: string
    description?: string
  }
  application?: ApplicationData
  reanalyzingRuleSet?: boolean
  onRuleSetOverride?: (ruleSetId: string) => void
}

function CheckCard({
  check,
  active,
  decision,
  readOnly,
  recordedDecision,
  amendmentCheckId,
  onDecision,
  onPreview,
  onSelect,
  onChangeDecision,
}: {
  check: ReviewCheck
  active: boolean
  decision?: QueueDecision
  readOnly: boolean
  recordedDecision?: QueueDecision
  amendmentCheckId?: ReviewCheck['id']
  onDecision: (id: ReviewCheck['id'], decision: QueueDecision) => void
  onPreview: (id: ReviewCheck['id'] | null) => void
  onSelect: (id: ReviewCheck['id']) => void
  onChangeDecision?: (id: ReviewCheck['id']) => void
}) {
  const interactive = Boolean(check.highlight)
  const decisionLocked = readOnly || Boolean(amendmentCheckId && decision && check.id !== amendmentCheckId)
  const humanReviewLead = check.id === 'warningFormat' && check.status === 'needs_review'
  const requirements = requirementsFor(check)

  function selectFromCard(event: MouseEvent<HTMLElement>) {
    if (!interactive || (event.target as HTMLElement).closest('button')) return
    onSelect(check.id)
  }

  function selectFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onSelect(check.id)
  }

  return (
    <article
      className={`check-card check-status-${check.status}${interactive ? ' check-card-highlightable' : ''}${active ? ' check-card-active' : ''}`}
      aria-label={`${check.label} automated finding`}
      data-review-check-id={check.id}
      tabIndex={interactive ? 0 : undefined}
      onClick={selectFromCard}
      onKeyDown={selectFromKeyboard}
      onFocus={() => interactive && onPreview(check.id)}
      onBlur={() => interactive && onPreview(null)}
      onMouseEnter={() => interactive && onPreview(check.id)}
      onMouseLeave={() => interactive && onPreview(null)}
    >
      <div className="check-header">
        <div>
          <span className={`status-icon status-${check.status}`} aria-hidden="true">
            {check.status === 'pass' ? '✓' : check.status === 'mismatch' ? '×' : '?'}
          </span>
          <h3>
            <span>{check.label}{requirements ? '' : ':'}</span>
            {!requirements && <> <span className="check-requirement">{check.expected}</span></>}
          </h3>
        </div>
        <span className={`status-badge status-${check.status}`}>{statusLabels[check.status]}</span>
      </div>

      {requirements && (
        <section className="warning-format-requirements" aria-label={`${check.label} requirements`}>
          <strong>{check.requirementsLabel ?? 'Requirements to verify'}</strong>
          <ul>
            {requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
          </ul>
        </section>
      )}

      <p className="check-explanation">
        <strong>{humanReviewLead ? 'AI determination: Human review required.' : `AI determination: ${statusLabels[check.status]}.`}</strong> {check.explanation}
      </p>

      {(check.applicabilityExplanation || check.applicationEvidence || check.labelEvidence) && (
        <dl className="check-evidence" aria-label={`${check.label} decision evidence`}>
          {check.applicabilityExplanation && <div><dt>Why this rule applies</dt><dd>{check.applicabilityExplanation}</dd></div>}
          {check.applicationEvidence && <div><dt>Application / supporting information</dt><dd>{check.applicationEvidence}</dd></div>}
          {check.labelEvidence && <div><dt>What the label shows</dt><dd>{check.labelEvidence}</dd></div>}
        </dl>
      )}

      {decisionLocked ? (
        <div className="locked-decision-row">
          <div className={`locked-decision locked-${decision ?? 'unknown'}`}>
            <span>Staff determination</span>
            <strong>{decision ? (decision === 'pass' ? 'Pass' : 'Fail') : recordedDecision === 'fail' ? 'Not required after confirmed failure' : 'Not recorded'}</strong>
          </div>
          {readOnly && decision && onChangeDecision && (
            <button className="change-decision-button" type="button" onClick={() => onChangeDecision(check.id)}>Change decision</button>
          )}
        </div>
      ) : (
        <fieldset className="staff-decision">
          <legend>Staff determination</legend>
          <div>
            <button
              className={decision === 'fail' ? 'decision-button decision-fail selected' : 'decision-button decision-fail'}
              type="button"
              aria-pressed={decision === 'fail'}
              onClick={() => onDecision(check.id, 'fail')}
            >
              Fail
            </button>
            <button
              className={decision === 'pass' ? 'decision-button decision-pass selected' : 'decision-button decision-pass'}
              type="button"
              aria-pressed={decision === 'pass'}
              onClick={() => onDecision(check.id, 'pass')}
            >
              Pass
            </button>
          </div>
        </fieldset>
      )}
    </article>
  )
}

const sectionStatusLabels: Record<ReviewSection['status'], string> = {
  mismatch: 'Potential problem',
  needs_review: 'Needs staff review',
  pass: 'Passed',
  not_applicable: 'Not applicable',
}

function sectionSummary(section: ReviewSection) {
  if (section.status === 'not_applicable') return 'No requirements in this section apply to this review.'
  const parts = []
  if (section.counts.mismatch) parts.push(`${section.counts.mismatch} potential ${section.counts.mismatch === 1 ? 'problem' : 'problems'}`)
  if (section.counts.needs_review) parts.push(`${section.counts.needs_review} ${section.counts.needs_review === 1 ? 'item needs' : 'items need'} staff judgment`)
  if (section.counts.pass) parts.push(`${section.counts.pass} ${section.counts.pass === 1 ? 'check passed' : 'checks passed'}`)
  return parts.join(' · ')
}

function SimplifiedSection({
  section,
  decisions,
  readOnly,
  recordedDecision,
  activeCheckId,
  onPass,
  onFail,
  onPreview,
  onSelect,
}: {
  section: ReviewSection
  decisions: StaffDecisions
  readOnly: boolean
  recordedDecision?: QueueDecision
  activeCheckId: ReviewCheck['id'] | null
  onPass: (checkIds: string[]) => void
  onFail: (checkId: string) => void
  onPreview: (id: ReviewCheck['id'] | null) => void
  onSelect: (id: ReviewCheck['id']) => void
}) {
  const failed = section.checks.some((check) => decisions[check.id] === 'fail')
  const passed = section.checks.length > 0 && section.checks.every((check) => decisions[check.id] === 'pass')
  const sectionDecision = failed ? 'fail' : passed ? 'pass' : undefined
  const firstAttentionCheck = section.checks.find((check) => check.status !== 'pass') ?? section.checks[0]

  return (
    <article className={`review-section-card review-section-${section.status}`} data-review-section-id={section.id}>
      <div className="review-section-heading">
        <div>
          <span className={`section-status-mark section-status-${section.status}`} aria-hidden="true">
            {section.status === 'mismatch' ? '!' : section.status === 'needs_review' ? '?' : section.status === 'pass' ? '✓' : '—'}
          </span>
          <div>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
          </div>
        </div>
        <span className={`section-status-label section-status-${section.status}`}>{sectionStatusLabels[section.status]}</span>
      </div>
      <p className="review-section-summary">{sectionSummary(section)}</p>

      {section.checks.length > 0 && (
        <details className="review-section-details" open={section.status === 'mismatch' || section.status === 'needs_review'}>
          <summary>View {section.checks.length} underlying {section.checks.length === 1 ? 'requirement' : 'requirements'}</summary>
          <div className="review-section-checks">
            {section.checks.map((check) => (
              <button
                className={`section-check-row section-check-${check.status}${activeCheckId === check.id ? ' active' : ''}`}
                key={check.id}
                type="button"
                onClick={() => onSelect(check.id)}
                onFocus={() => onPreview(check.id)}
                onBlur={() => onPreview(null)}
                onMouseEnter={() => onPreview(check.id)}
                onMouseLeave={() => onPreview(null)}
              >
                <span>{check.status === 'mismatch' ? '!' : check.status === 'needs_review' ? '?' : '✓'}</span>
                <span><strong>{check.label}</strong><small>{check.explanation}</small></span>
                <span>{statusLabels[check.status]}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      {section.status !== 'not_applicable' && (
        readOnly ? (
          <div className={`section-recorded-decision section-recorded-${sectionDecision ?? 'unknown'}`}>
            <span>Staff determination</span>
            <strong>{sectionDecision === 'pass' ? 'Meets requirements' : sectionDecision === 'fail' ? 'Does not meet requirements' : recordedDecision === 'fail' ? 'Not required after confirmed failure' : 'Not recorded'}</strong>
          </div>
        ) : (
          <div className="section-decision-buttons" aria-label={`${section.title} staff determination`}>
            <button
              className={sectionDecision === 'fail' ? 'decision-button decision-fail selected' : 'decision-button decision-fail'}
              type="button"
              onClick={() => firstAttentionCheck && onFail(firstAttentionCheck.id)}
            >
              Does not meet requirements
            </button>
            <button
              className={sectionDecision === 'pass' ? 'decision-button decision-pass selected' : 'decision-button decision-pass'}
              type="button"
              onClick={() => onPass(section.checks.map((check) => check.id))}
            >
              Meets requirements
            </button>
          </div>
        )
      )}
    </article>
  )
}

function normalizeRotation(value: number): SavedRotation {
  return (((value % 360) + 360) % 360) as SavedRotation
}

export function ReviewResults({
  result,
  previewUrl,
  fileName,
  readOnly = false,
  initialDecisions = {},
  initialRotation = 0,
  recordedDecision,
  amendmentCheckId,
  onFinalDecision,
  onPause,
  pauseLabel = 'Pause review',
  onChangeDecision,
  pageContext,
  application,
  reanalyzingRuleSet = false,
  onRuleSetOverride,
}: Props) {
  const [previewedCheck, setPreviewedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [selectedCheck, setSelectedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [staffDecisions, setStaffDecisions] = useState<StaffDecisions>(initialDecisions)
  const [pendingFail, setPendingFail] = useState<ReviewCheck['id'] | null>(null)
  const [pendingPass, setPendingPass] = useState(false)
  const [pendingAmendmentFinal, setPendingAmendmentFinal] = useState<QueueDecision | null>(null)
  const [pendingChangeId, setPendingChangeId] = useState<ReviewCheck['id'] | null>(null)
  const [bulkReminder, setBulkReminder] = useState<{ passedCount: number, checkIds: string[] } | null>(null)
  const [amendmentTouched, setAmendmentTouched] = useState(false)
  const [submittedDecision, setSubmittedDecision] = useState<QueueDecision | null>(null)
  const [savedRotation, setSavedRotation] = useState<SavedRotation>(initialRotation)
  const [draftRotation, setDraftRotation] = useState<SavedRotation>(initialRotation)
  const [zoom, setZoom] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const dragSession = useRef<{ pointerId: number, startX: number, startY: number, panX: number, panY: number } | null>(null)
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 })
  const [viewedCheckIds, setViewedCheckIds] = useState<Set<string>>(() => new Set())
  const [commandBarOffset, setCommandBarOffset] = useState(96)
  const [resultsView, setResultsView] = useState<'current' | 'simplified'>('current')
  const resultsSectionRef = useRef<HTMLElement | null>(null)
  const commandBarRef = useRef<HTMLDivElement | null>(null)
  const reviewApplication = result.application ?? application
  const reviewContext = reviewApplication ? reviewContextFromApplication(reviewApplication) : {}
  const ruleSelection = result.ruleSelection ?? selectAutomaticRuleSet(reviewContext)

  const sortedChecks = useMemo(
    () => result.checks.map((check, index) => ({ check, index }))
      .sort((left, right) => statusPriority[left.check.status] - statusPriority[right.check.status] || left.index - right.index)
      .map(({ check }) => check),
    [result.checks],
  )
  const reviewSections = useMemo(() => buildReviewSections(result.checks), [result.checks])
  const effectiveResultsView = amendmentCheckId ? 'current' : resultsView
  const checkSetKey = sortedChecks.map((check) => check.id).join('|')
  const activeCheckId = previewedCheck ?? selectedCheck
  const activeCheck = result.checks.find((check) => check.id === activeCheckId)
  const highlight = activeCheck?.highlight
  const highlightStatus = activeCheck?.status
  const decidedCount = result.checks.filter((check) => staffDecisions[check.id]).length
  const remainingGreenChecks = result.checks.filter((check) => check.status === 'pass' && !staffDecisions[check.id])
  const allCardsViewed = result.checks.length > 0 && result.checks.every((check) => viewedCheckIds.has(check.id))
  const amendmentFinalDecision: QueueDecision | null = result.checks.some((check) => staffDecisions[check.id] === 'fail')
    ? 'fail'
    : result.checks.every((check) => staffDecisions[check.id] === 'pass')
      ? 'pass'
      : null
  const dimensions = result.checks.find((check) => check.highlight)?.highlight
  const sourceWidth = dimensions?.imageWidth ?? naturalSize.width
  const sourceHeight = dimensions?.imageHeight ?? naturalSize.height
  const quarterTurn = draftRotation === 90 || draftRotation === 270
  const stageWidth = quarterTurn ? sourceHeight : sourceWidth
  const stageHeight = quarterTurn ? sourceWidth : sourceHeight
  const stageStyle: CSSProperties = { aspectRatio: `${stageWidth} / ${stageHeight}` }
  const highlightBounds = highlight?.boxes.reduce(
    (bounds, box) => ({
      x0: Math.min(bounds.x0, box.x0),
      y0: Math.min(bounds.y0, box.y0),
      x1: Math.max(bounds.x1, box.x1),
      y1: Math.max(bounds.y1, box.y1),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  )
  const zoomOrigin = highlight && highlightBounds
    ? `${((highlightBounds.x0 + highlightBounds.x1) / 2 / highlight.imageWidth) * 100}% ${((highlightBounds.y0 + highlightBounds.y1) / 2 / highlight.imageHeight) * 100}%`
    : '50% 50%'
  const zoomCanvasStyle: CSSProperties = { transform: `scale(${zoom / 100})`, transformOrigin: zoomOrigin }
  const panCanvasStyle: CSSProperties = { transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }
  const canvasStyle: CSSProperties = quarterTurn
    ? {
        width: `${(sourceWidth / sourceHeight) * 100}%`,
        height: `${(sourceHeight / sourceWidth) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${draftRotation}deg)`,
      }
    : { width: '100%', height: '100%', transform: `translate(-50%, -50%) rotate(${draftRotation}deg)` }

  useEffect(() => {
    setViewedCheckIds(new Set())
    setBulkReminder(null)
  }, [checkSetKey])

  useEffect(() => {
    if (readOnly || amendmentCheckId || typeof IntersectionObserver === 'undefined') return
    const cards = resultsSectionRef.current?.querySelectorAll<HTMLElement>('[data-review-check-id]') ?? []
    const observer = new IntersectionObserver((entries) => {
      const newlyViewed = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => (entry.target as HTMLElement).dataset.reviewCheckId)
        .filter((id): id is string => Boolean(id))
      if (!newlyViewed.length) return
      setViewedCheckIds((current) => {
        if (newlyViewed.every((id) => current.has(id))) return current
        const next = new Set(current)
        newlyViewed.forEach((id) => next.add(id))
        return next
      })
    }, { threshold: 0.2 })
    cards.forEach((cardElement) => observer.observe(cardElement))
    return () => observer.disconnect()
  }, [amendmentCheckId, checkSetKey, readOnly])

  useEffect(() => {
    const commandBar = commandBarRef.current
    if (!commandBar) return
    const updateOffset = () => setCommandBarOffset(Math.ceil(commandBar.getBoundingClientRect().height) + 18)
    updateOffset()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateOffset)
    observer.observe(commandBar)
    return () => observer.disconnect()
  }, [])

  function selectCheck(id: ReviewCheck['id']) {
    setSelectedCheck((current) => (current === id ? null : id))
  }

  function recordDecision(id: ReviewCheck['id'], decision: QueueDecision) {
    if (amendmentCheckId) setAmendmentTouched(true)
    if (decision === 'fail') {
      setPendingFail(id)
      return
    }
    const next = { ...staffDecisions, [id]: decision }
    setStaffDecisions(next)
    setSubmittedDecision(null)
    if (result.checks.every((check) => next[check.id] === 'pass')) setPendingPass(true)
  }

  function passSection(checkIds: string[]) {
    const next = { ...staffDecisions }
    checkIds.forEach((id) => { next[id] = 'pass' })
    setStaffDecisions(next)
    setSubmittedDecision(null)
    if (result.checks.every((check) => next[check.id] === 'pass')) setPendingPass(true)
  }

  function changeRuleSet(ruleSetId: string) {
    setStaffDecisions({})
    setPendingFail(null)
    setPendingPass(false)
    setPendingAmendmentFinal(null)
    setSubmittedDecision(null)
    setSelectedCheck(null)
    setPreviewedCheck(null)
    setViewedCheckIds(new Set())
    setBulkReminder(null)
    onRuleSetOverride?.(ruleSetId)
  }

  function passRemainingGreenChecks() {
    const next = { ...staffDecisions }
    remainingGreenChecks.forEach((check) => { next[check.id] = 'pass' })
    const individuallyRequired = result.checks.filter((check) => (
      check.status !== 'pass' && !next[check.id]
    ))
    setStaffDecisions(next)
    setSubmittedDecision(null)
    setBulkReminder(individuallyRequired.length
      ? { passedCount: remainingGreenChecks.length, checkIds: individuallyRequired.map((check) => check.id) }
      : null)
    if (result.checks.every((check) => next[check.id] === 'pass')) setPendingPass(true)
  }

  function continueRequiredReview() {
    const firstId = bulkReminder?.checkIds[0]
    setBulkReminder(null)
    if (!firstId) return
    const card = [...(resultsSectionRef.current?.querySelectorAll<HTMLElement>('[data-review-check-id]') ?? [])]
      .find((element) => element.dataset.reviewCheckId === firstId)
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function submit(decision: QueueDecision, decisions: StaffDecisions) {
    setSubmittedDecision(decision)
    onFinalDecision?.(decision, decisions, savedRotation)
  }

  function confirmQuickFail() {
    if (pendingFail) {
      const next = { ...staffDecisions, [pendingFail]: 'fail' as const }
      setStaffDecisions(next)
      setPendingFail(null)
      submit('fail', next)
      return
    }
    if (pendingAmendmentFinal === 'fail') {
      setPendingAmendmentFinal(null)
      submit('fail', staffDecisions)
    }
  }

  function confirmPass() {
    setPendingPass(false)
    setPendingAmendmentFinal(null)
    submit('pass', staffDecisions)
  }

  function rotate(delta: number) {
    setDraftRotation((current) => normalizeRotation(current + delta))
  }

  function saveRotation() {
    setSavedRotation(draftRotation)
  }

  function changeZoom(delta: number) {
    setZoom((current) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta))
      if (next <= 100) setPan({ x: 0, y: 0 })
      return next
    })
  }

  function resetZoom() {
    setZoom(100)
    setPan({ x: 0, y: 0 })
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (zoom <= 100 || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragSession.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setIsPanning(true)
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragSession.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    setPan({ x: drag.panX + event.clientX - drag.startX, y: drag.panY + event.clientY - drag.startY })
  }

  function stopPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragSession.current?.pointerId !== event.pointerId) return
    dragSession.current = null
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const dialogDecision = pendingFail ? 'fail' : pendingPass ? 'pass' : pendingAmendmentFinal

  return (
    <section
      className="results-section"
      aria-labelledby="results-title"
      ref={resultsSectionRef}
      style={{ '--review-command-offset': `${commandBarOffset}px` } as CSSProperties}
    >
      <div className="review-command-bar" ref={commandBarRef}>
        <div>
          <h2 id="results-title">{readOnly ? 'Completed label decision' : amendmentCheckId ? 'Update this label compliance determination' : 'Make your label compliance determination'}</h2>
          <strong>{readOnly ? `Final decision: ${recordedDecision === 'pass' ? 'Pass' : 'Fail'}` : `${decidedCount} of ${result.checks.length} decided${amendmentCheckId ? ' · previous answers preserved' : ''}`}</strong>
        </div>
        <RuleSetControl
          selection={ruleSelection}
          context={reviewContext}
          readOnly={readOnly}
          reanalyzing={reanalyzingRuleSet}
          onOverride={onRuleSetOverride ? changeRuleSet : undefined}
        />
        <div className="compact-metrics">
          <span><strong>{Math.round(result.ocrConfidence)}%</strong> OCR confidence</span>
          <span className={result.durationMs <= 5000 ? 'metric-good' : 'metric-slow'}>
            <strong>{(result.durationMs / 1000).toFixed(1)}s</strong> {result.durationMs <= 5000 ? 'within target' : 'above target'}
          </span>
        </div>
        {!readOnly && onPause && <button className="secondary-button" type="button" onClick={onPause}>{pauseLabel}</button>}
      </div>

      {pageContext && (
        <div className="results-page-heading queue-review-heading results-context-heading">
          <div>
            <p className="eyebrow">{pageContext.eyebrow}</p>
            <h1>{pageContext.title}</h1>
            {pageContext.description && <p>{pageContext.description}</p>}
          </div>
        </div>
      )}

      {!amendmentCheckId && (
        <section className="results-view-switch" aria-label="Results view">
          <div>
            <strong>Compare results layouts</strong>
            <span>The current review remains available while you try the simplified preview.</span>
          </div>
          <div>
            <button className={effectiveResultsView === 'current' ? 'selected' : ''} type="button" onClick={() => setResultsView('current')}>Current results</button>
            <button className={effectiveResultsView === 'simplified' ? 'selected' : ''} type="button" onClick={() => setResultsView('simplified')}>Simplified preview</button>
          </div>
        </section>
      )}

      <div className="results-comparison">
        <figure className="results-preview" aria-label="Label artwork with OCR highlight">
          <div className="results-preview-heading">
            <div><span>Label artwork</span><strong>{activeCheck?.label ?? 'Hover, focus, or tap a result'}</strong></div>
            {highlight && <span className={`highlight-key highlight-${highlightStatus}`}><i /> {statusLabels[highlightStatus!]}</span>}
          </div>

          <div className="preview-controls">
            {!readOnly && (
              <div className="rotation-controls" aria-label="Label orientation controls">
                <button type="button" onClick={() => rotate(-90)} aria-label="Rotate 90 degrees counterclockwise">↶ 90°</button>
                <button type="button" onClick={() => rotate(90)} aria-label="Rotate 90 degrees clockwise">90° ↷</button>
                <button type="button" className="save-rotation" disabled={draftRotation === savedRotation} onClick={saveRotation}>Save orientation</button>
                {draftRotation !== savedRotation && <button type="button" onClick={() => setDraftRotation(savedRotation)}>Cancel</button>}
              </div>
            )}

            <div className="zoom-controls" aria-label="Label zoom controls">
              <button
                type="button"
                disabled={zoom === MIN_ZOOM}
                onClick={() => changeZoom(-ZOOM_STEP)}
                aria-label="Zoom out"
              >−</button>
              <button type="button" className="zoom-level" disabled={zoom === 100} onClick={resetZoom} aria-label={`Reset zoom to 100 percent; current zoom ${zoom} percent`}>
                {zoom}%
              </button>
              <button
                type="button"
                disabled={zoom === MAX_ZOOM}
                onClick={() => changeZoom(ZOOM_STEP)}
                aria-label="Zoom in"
              >+</button>
            </div>
          </div>

          <div
            className={`results-preview-frame rotation-stage${zoom > 100 ? ' can-pan' : ''}${isPanning ? ' is-panning' : ''}`}
            id="results-label-preview"
            style={stageStyle}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onPointerCancel={stopPan}
            onLostPointerCapture={stopPan}
          >
            <div className="pan-canvas" style={panCanvasStyle}>
              <div className="rotation-canvas" style={canvasStyle}>
                <div className="zoom-canvas" style={zoomCanvasStyle}>
                  <img
                    src={previewUrl}
                    alt="Alcohol label used for this review"
                    draggable="false"
                    onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                  />
                  {highlight && (
                    <svg className="ocr-highlight-layer" viewBox={`0 0 ${highlight.imageWidth} ${highlight.imageHeight}`} aria-hidden="true" preserveAspectRatio="none">
                      {highlight.boxes.map((box, index) => {
                        const points = box.points ?? [
                          { x: box.x0, y: box.y0 }, { x: box.x1, y: box.y0 },
                          { x: box.x1, y: box.y1 }, { x: box.x0, y: box.y1 },
                        ]
                        return <polygon className={`ocr-highlight-box highlight-${highlightStatus}`} key={`${box.x0}-${box.y0}-${index}`} points={points.map((point) => `${point.x},${point.y}`).join(' ')} />
                      })}
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
          <figcaption title={fileName}>{fileName} · {draftRotation}° orientation · {zoom}% zoom</figcaption>
        </figure>

        <div>
          {effectiveResultsView === 'current' ? (
            <div className="check-list">
              {sortedChecks.map((check) => (
                <CheckCard
                  check={check}
                  active={activeCheckId === check.id}
                  decision={staffDecisions[check.id]}
                  key={check.id}
                  readOnly={readOnly}
                  recordedDecision={recordedDecision}
                  amendmentCheckId={amendmentCheckId}
                  onDecision={recordDecision}
                  onPreview={setPreviewedCheck}
                  onSelect={selectCheck}
                  onChangeDecision={onChangeDecision ? setPendingChangeId : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="review-section-list">
              {reviewSections.map((section) => (
                <SimplifiedSection
                  section={section}
                  decisions={staffDecisions}
                  key={section.id}
                  readOnly={readOnly}
                  recordedDecision={recordedDecision}
                  activeCheckId={activeCheckId}
                  onPass={passSection}
                  onFail={(id) => recordDecision(id, 'fail')}
                  onPreview={setPreviewedCheck}
                  onSelect={selectCheck}
                />
              ))}
            </div>
          )}
          {effectiveResultsView === 'current' && !readOnly && !amendmentCheckId && allCardsViewed && remainingGreenChecks.length > 0 && (
            <section className="pass-remaining-panel" aria-label="Pass remaining green findings">
              <div>
                <strong>All review cards viewed</strong>
                <span>Only the {remainingGreenChecks.length} remaining green {remainingGreenChecks.length === 1 ? 'item' : 'items'} will be marked Pass. Red and amber items still require individual decisions.</span>
              </div>
              <button className="pass-remaining-button" type="button" onClick={passRemainingGreenChecks}>
                Pass all remaining green {remainingGreenChecks.length === 1 ? 'item' : 'items'}
              </button>
            </section>
          )}
          <details className="ocr-details"><summary>View raw OCR text</summary><pre>{result.ocrText || 'No text was extracted.'}</pre></details>
        </div>
      </div>

      {amendmentCheckId && amendmentTouched && amendmentFinalDecision && !dialogDecision && (
        <div className={`amendment-submit amendment-submit-${amendmentFinalDecision}`}>
          <div>
            <strong>Updated final determination: {amendmentFinalDecision === 'pass' ? 'Pass' : 'Fail'}</strong>
            <span>Submit to create a new revision. The previous decision will remain in history.</span>
          </div>
          <button
            className={amendmentFinalDecision === 'pass' ? 'confirm-pass-button' : 'confirm-fail-button'}
            type="button"
            onClick={() => amendmentFinalDecision === 'pass' ? setPendingPass(true) : setPendingAmendmentFinal('fail')}
          >
            Submit updated decision
          </button>
        </div>
      )}

      {submittedDecision && !onFinalDecision && (
        <p className={`decision-recorded-banner decision-${submittedDecision}`} role="status">Final {submittedDecision === 'pass' ? 'Pass' : 'Fail'} decision recorded for this browser session.</p>
      )}

      {bulkReminder && (
        <div className="quick-fail-backdrop" role="presentation">
          <section className="quick-fail-dialog bulk-reminder-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bulk-reminder-title">
            <span className="quick-fail-icon" aria-hidden="true">!</span>
            <p className="eyebrow">Individual review still required</p>
            <h2 id="bulk-reminder-title">Review the remaining red and amber items</h2>
            <p>{bulkReminder.passedCount} green {bulkReminder.passedCount === 1 ? 'item was' : 'items were'} marked Pass. The following findings were not changed and must each be marked Pass or Fail before this label can receive a final Pass:</p>
            <ul>
              {bulkReminder.checkIds.map((id) => <li key={id}>{result.checks.find((check) => check.id === id)?.label ?? id}</li>)}
            </ul>
            <div>
              <button className="primary-button" type="button" onClick={continueRequiredReview} autoFocus>Review remaining items</button>
            </div>
          </section>
        </div>
      )}

      {pendingChangeId && (
        <div className="quick-fail-backdrop" role="presentation">
          <section className="quick-fail-dialog change-decision-dialog" role="alertdialog" aria-modal="true" aria-labelledby="change-dialog-title">
            <span className="quick-fail-icon" aria-hidden="true">↻</span>
            <p className="eyebrow">Change a completed decision</p>
            <h2 id="change-dialog-title">Change the staff decision for {result.checks.find((check) => check.id === pendingChangeId)?.label}?</h2>
            <p>Your previous answers will be preserved. Nothing changes until you submit an updated final decision.</p>
            <div>
              <button className="secondary-button" type="button" onClick={() => setPendingChangeId(null)}>Keep completed decision</button>
              <button className="primary-button" type="button" onClick={() => { const id = pendingChangeId; setPendingChangeId(null); onChangeDecision?.(id) }} autoFocus>Continue to change decision</button>
            </div>
          </section>
        </div>
      )}

      {dialogDecision && (
        <div className="quick-fail-backdrop" role="presentation">
          <section className={`quick-fail-dialog decision-dialog-${dialogDecision}`} role="alertdialog" aria-modal="true" aria-labelledby="decision-dialog-title">
            <span className="quick-fail-icon" aria-hidden="true">{dialogDecision === 'pass' ? '✓' : '!'}</span>
            <p className="eyebrow">Final staff decision</p>
            <h2 id="decision-dialog-title">Confirm this label has {dialogDecision === 'pass' ? 'passed' : 'failed'}?</h2>
            <p>{dialogDecision === 'pass' ? 'Every item is marked Pass. Confirm the final compliant-label decision.' : 'Confirming records a final Fail without requiring answers for the remaining checks.'}</p>
            <div>
              <button className="secondary-button" type="button" onClick={() => { setPendingFail(null); setPendingPass(false); setPendingAmendmentFinal(null) }}>Go back to review</button>
              <button className={dialogDecision === 'pass' ? 'confirm-pass-button' : 'confirm-fail-button'} type="button" onClick={dialogDecision === 'pass' ? confirmPass : confirmQuickFail} autoFocus>
                Confirm {dialogDecision === 'pass' ? 'Pass decision' : 'failure'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
