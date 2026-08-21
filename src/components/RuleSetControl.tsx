import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  evaluateRuleSet,
  rankAlternativeRuleSets,
  type ReviewContext,
  type RuleSetSelection,
} from '../domain/ruleEngine'
import { RULE_SET_SPECIFICATIONS } from '../domain/ruleSpecification'
import { appUrl } from '../routing'

type Props = {
  selection: RuleSetSelection
  context: ReviewContext
  readOnly?: boolean
  reanalyzing?: boolean
  onOverride?: (ruleSetId: string) => void
}

const applicabilityLabels = {
  applies: 'Applies',
  does_not_apply: 'Does not apply',
  missing_context: 'Missing context',
} as const

export function RuleSetControl({
  selection,
  context,
  readOnly = false,
  reanalyzing = false,
  onOverride,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pendingRuleSetId, setPendingRuleSetId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const selectedRuleSet = RULE_SET_SPECIFICATIONS.find(
    (ruleSet) => ruleSet.id === selection.selectedRuleSetId,
  )
  const automaticRuleSet = RULE_SET_SPECIFICATIONS.find(
    (ruleSet) => ruleSet.id === selection.automaticRuleSetId,
  )
  const evaluation = selectedRuleSet ? evaluateRuleSet(selectedRuleSet.id, context) : undefined
  const alternatives = useMemo(
    () => open ? rankAlternativeRuleSets(context, selectedRuleSet?.id) : [],
    [context, open, selectedRuleSet?.id],
  )
  const pendingRuleSet = RULE_SET_SPECIFICATIONS.find(
    (ruleSet) => ruleSet.id === pendingRuleSetId,
  )
  const pendingAlternative = alternatives.find(
    (alternative) => alternative.ruleSet.id === pendingRuleSetId,
  )
  const visibleRules = evaluation?.rules.filter((entry) => entry.status !== 'does_not_apply') ?? []
  const nonApplicableRules = evaluation?.rules.filter((entry) => entry.status === 'does_not_apply') ?? []

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const trigger = triggerRef.current
    document.body.style.overflow = 'hidden'
    const dialog = dialogRef.current
    const focusableSelector = 'a[href], button:not([disabled]), select:not([disabled]), details > summary, [tabindex]:not([tabindex="-1"])'
    const focusTimer = window.setTimeout(() => {
      dialog?.querySelector<HTMLElement>('.dialog-close-button')?.focus()
    }, 0)

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        setPendingRuleSetId(null)
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleDocumentKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [open])

  function close() {
    setOpen(false)
    setPendingRuleSetId(null)
  }

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) close()
  }

  function applyOverride() {
    if (!pendingRuleSetId || !onOverride) return
    onOverride(pendingRuleSetId)
    close()
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`rule-set-trigger${selection.mode === 'reviewer_override' ? ' rule-set-overridden' : ''}`}
        type="button"
        onClick={() => setOpen(true)}
        title="View why this rule set was selected or choose another"
        aria-haspopup="dialog"
        aria-label={`Rules: ${selectedRuleSet?.label ?? 'More context needed'}`}
      >
        <span>Rules</span>
        <strong>{selectedRuleSet?.label ?? 'More context needed'}</strong>
        <i aria-hidden="true">⌄</i>
      </button>

      {open && createPortal(
        <div className="rule-set-backdrop" role="presentation" onMouseDown={closeFromBackdrop}>
          <section
            ref={dialogRef}
            className="rule-set-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rule-set-dialog-title"
          >
            <div className="rule-set-dialog-header">
              <div>
                <p className="eyebrow">Rules applied to this review</p>
                <h2 id="rule-set-dialog-title">{selectedRuleSet?.label ?? 'Rule set needs context'}</h2>
              </div>
              <button className="dialog-close-button" type="button" onClick={close} aria-label="Close rule-set details" autoFocus>×</button>
            </div>

            {evaluation && (
              <section className="rule-set-current-rules" aria-labelledby="current-rules-title">
                <div className="rule-set-section-heading">
                  <div>
                    <h3 id="current-rules-title">Rules in this set</h3>
                    <p>{evaluation.counts.applies} apply · {evaluation.counts.missing_context} need context</p>
                  </div>
                  <a href={appUrl(`/rules/${evaluation.ruleSet.id}`)} target="_blank" rel="noreferrer">Open full rule set ↗</a>
                </div>
                <div className="rule-detail-list">
                  {visibleRules.map((entry) => (
                    <details key={entry.rule.id}>
                      <summary>
                        <span>{entry.rule.title}</span>
                        <i className={`applicability applicability-${entry.status}`}>{applicabilityLabels[entry.status]}</i>
                      </summary>
                      <p>{entry.rule.requirement}</p>
                      {entry.status === 'missing_context' && <strong>Needed: {entry.missingFacts.join(', ')}</strong>}
                    </details>
                  ))}
                </div>
                {nonApplicableRules.length > 0 && (
                  <details className="nonapplicable-rule-group">
                    <summary>Show {nonApplicableRules.length} rules that do not apply</summary>
                    <div className="rule-detail-list">
                      {nonApplicableRules.map((entry) => (
                        <details key={entry.rule.id}>
                          <summary>
                            <span>{entry.rule.title}</span>
                            <i className="applicability applicability-does_not_apply">Does not apply</i>
                          </summary>
                          <p>{entry.rule.requirement}</p>
                        </details>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            )}

            <section className="rule-set-selection-reasons" aria-labelledby="selection-reasons-title">
              <h3 id="selection-reasons-title">Why this set was selected</h3>
              <div className="rule-set-selection-summary">
                <span className={selection.mode === 'reviewer_override' ? 'selection-mode override' : 'selection-mode automatic'}>
                  {selection.mode === 'reviewer_override' ? 'Reviewer-selected' : 'Automatically selected'}
                </span>
                {selection.reasons.map((reason) => <span key={reason}>{reason}</span>)}
                {selection.conflicts.map((conflict) => <strong key={conflict}>Check: {conflict}</strong>)}
                {selection.missingFacts.length > 0 && <strong>Missing routing facts: {selection.missingFacts.join(', ')}</strong>}
                {selection.reanalysisMs !== undefined && (
                  <span>Cached reanalysis: {selection.reanalysisMs < 10 ? '<10' : Math.round(selection.reanalysisMs)} ms · no OCR rerun</span>
                )}
              </div>
            </section>

            {!readOnly && onOverride && (
              <section className="rule-set-alternatives" aria-labelledby="alternative-rules-title">
                <div className="rule-set-section-heading">
                  <div>
                    <h3 id="alternative-rules-title">Change the rule set</h3>
                    <p>Closest matches appear first. Review the details before rerunning the analysis.</p>
                  </div>
                </div>

                <label className="rule-set-chooser">
                  <span>Alternate rule set</span>
                  <select value={pendingRuleSetId ?? ''} onChange={(event) => setPendingRuleSetId(event.target.value || null)}>
                    <option value="">Select a rule set to inspect</option>
                    {alternatives.map((alternative, index) => (
                      <option value={alternative.ruleSet.id} key={alternative.ruleSet.id}>
                        {automaticRuleSet?.id === alternative.ruleSet.id && selection.mode === 'reviewer_override'
                          ? `Automatic selection — ${alternative.ruleSet.label}`
                          : `${index < 3 ? `Likely alternative ${index + 1}` : 'Other rule set'} — ${alternative.ruleSet.label}`}
                      </option>
                    ))}
                  </select>
                </label>

                {pendingRuleSet && (
                  <div className="rule-set-override-confirmation" role="status">
                    <h4>{pendingRuleSet.label}</h4>
                    <p>{pendingRuleSet.description}</p>
                    {pendingAlternative?.reasons.map((reason) => <p key={reason}><strong>Match:</strong> {reason}</p>)}
                    {pendingAlternative?.conflicts.map((conflict) => <p className="rule-set-conflict" key={conflict}>Application conflict: {conflict}</p>)}
                    <p>Cached OCR text, coordinates, and image evidence will be reused. Staff answers for affected cards will be cleared.</p>
                    <button className="primary-button" type="button" onClick={applyOverride} disabled={reanalyzing}>
                      {reanalyzing ? 'Reanalyzing…' : 'Apply rule set and reanalyze'}
                    </button>
                  </div>
                )}
              </section>
            )}

          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
