import { useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import type { CheckStatus, ReviewCheck, ReviewOutcome } from '../domain/reviewSchema'
import type { QueueDecision, SavedRotation, StaffDecisions } from '../reviewQueue'

const statusLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  mismatch: 'Mismatch',
  needs_review: 'Human review',
}

const statusPriority: Record<CheckStatus, number> = { mismatch: 0, needs_review: 1, pass: 2 }

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
          <h3><span>{check.label}:</span> <span className="check-requirement">{check.expected}</span></h3>
        </div>
        <span className={`status-badge status-${check.status}`}>{statusLabels[check.status]}</span>
      </div>

      <p className="check-explanation">
        <strong>{humanReviewLead ? 'AI determination: Human review required — not an automated failure.' : `AI determination: ${statusLabels[check.status]}.`}</strong> {check.explanation}
      </p>

      {decisionLocked ? (
        <div className="locked-decision-row">
          <div className={`locked-decision locked-${decision ?? 'unknown'}`}>
            <span>Staff determination</span>
            <strong>{decision ? (decision === 'pass' ? 'Pass' : 'Fail') : recordedDecision === 'fail' ? 'Not required after confirmed failure' : 'Not recorded'}</strong>
          </div>
          {readOnly && onChangeDecision && (
            <button className="change-decision-button" type="button" onClick={() => onChangeDecision(check.id)}>Change decision</button>
          )}
        </div>
      ) : (
        <fieldset className="staff-decision">
          <legend>Staff determination</legend>
          <div>
            <button
              className={decision === 'pass' ? 'decision-button decision-pass selected' : 'decision-button decision-pass'}
              type="button"
              aria-pressed={decision === 'pass'}
              onClick={() => onDecision(check.id, 'pass')}
            >
              Pass
            </button>
            <button
              className={decision === 'fail' ? 'decision-button decision-fail selected' : 'decision-button decision-fail'}
              type="button"
              aria-pressed={decision === 'fail'}
              onClick={() => onDecision(check.id, 'fail')}
            >
              Fail
            </button>
          </div>
        </fieldset>
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
}: Props) {
  const [previewedCheck, setPreviewedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [selectedCheck, setSelectedCheck] = useState<ReviewCheck['id'] | null>(null)
  const [staffDecisions, setStaffDecisions] = useState<StaffDecisions>(initialDecisions)
  const [pendingFail, setPendingFail] = useState<ReviewCheck['id'] | null>(null)
  const [pendingPass, setPendingPass] = useState(false)
  const [pendingAmendmentFinal, setPendingAmendmentFinal] = useState<QueueDecision | null>(null)
  const [pendingChangeId, setPendingChangeId] = useState<ReviewCheck['id'] | null>(null)
  const [amendmentTouched, setAmendmentTouched] = useState(false)
  const [submittedDecision, setSubmittedDecision] = useState<QueueDecision | null>(null)
  const [savedRotation, setSavedRotation] = useState<SavedRotation>(initialRotation)
  const [draftRotation, setDraftRotation] = useState<SavedRotation>(initialRotation)
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 })

  const sortedChecks = useMemo(
    () => result.checks.map((check, index) => ({ check, index }))
      .sort((left, right) => statusPriority[left.check.status] - statusPriority[right.check.status] || left.index - right.index)
      .map(({ check }) => check),
    [result.checks],
  )
  const activeCheckId = previewedCheck ?? selectedCheck
  const activeCheck = result.checks.find((check) => check.id === activeCheckId)
  const highlight = activeCheck?.highlight
  const highlightStatus = activeCheck?.status
  const decidedCount = result.checks.filter((check) => staffDecisions[check.id]).length
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
  const canvasStyle: CSSProperties = quarterTurn
    ? {
        width: `${(sourceWidth / sourceHeight) * 100}%`,
        height: `${(sourceHeight / sourceWidth) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${draftRotation}deg)`,
      }
    : { width: '100%', height: '100%', transform: `translate(-50%, -50%) rotate(${draftRotation}deg)` }

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

  const dialogDecision = pendingFail ? 'fail' : pendingPass ? 'pass' : pendingAmendmentFinal

  return (
    <section className="results-section" aria-labelledby="results-title">
      <div className="review-command-bar">
        <div>
          <h2 id="results-title">{readOnly ? 'Completed label decision' : amendmentCheckId ? 'Update this label compliance determination' : 'Make your label compliance determination'}</h2>
          <strong>{readOnly ? `Final decision: ${recordedDecision === 'pass' ? 'Pass' : 'Fail'}` : `${decidedCount} of ${result.checks.length} decided${amendmentCheckId ? ' · previous answers preserved' : ''}`}</strong>
        </div>
        <div className="compact-metrics">
          <span><strong>{Math.round(result.ocrConfidence)}%</strong> OCR confidence</span>
          <span className={result.durationMs <= 5000 ? 'metric-good' : 'metric-slow'}>
            <strong>{(result.durationMs / 1000).toFixed(1)}s</strong> {result.durationMs <= 5000 ? 'within target' : 'above target'}
          </span>
        </div>
        {!readOnly && onPause && <button className="secondary-button" type="button" onClick={onPause}>{pauseLabel}</button>}
      </div>

      <div className="results-comparison">
        <figure className="results-preview" aria-label="Label artwork with OCR highlight">
          <div className="results-preview-heading">
            <div><span>Label artwork</span><strong>{activeCheck?.label ?? 'Hover, focus, or tap a result'}</strong></div>
            {highlight && <span className={`highlight-key highlight-${highlightStatus}`}><i /> {statusLabels[highlightStatus!]}</span>}
          </div>

          {!readOnly && (
            <div className="rotation-controls" aria-label="Label orientation controls">
              <button type="button" onClick={() => rotate(-90)} aria-label="Rotate 90 degrees counterclockwise">↶ 90°</button>
              <button type="button" onClick={() => rotate(90)} aria-label="Rotate 90 degrees clockwise">90° ↷</button>
              <button type="button" className="save-rotation" disabled={draftRotation === savedRotation} onClick={saveRotation}>Save orientation</button>
              {draftRotation !== savedRotation && <button type="button" onClick={() => setDraftRotation(savedRotation)}>Cancel</button>}
            </div>
          )}

          <div className="results-preview-frame rotation-stage" id="results-label-preview" style={stageStyle}>
            <div className="rotation-canvas" style={canvasStyle}>
              <img
                src={previewUrl}
                alt="Alcohol label used for this review"
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
          <figcaption title={fileName}>{fileName} · {draftRotation}° orientation</figcaption>
        </figure>

        <div>
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
