import { useMemo, useState, type KeyboardEvent } from 'react'
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

  function close() {
    setOpen(false)
    setPendingRuleSetId(null)
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') close()
  }

  function applyOverride() {
    if (!pendingRuleSetId || !onOverride) return
    onOverride(pendingRuleSetId)
    close()
  }

  return (
    <>
      <button
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

      {open && (
        <div className="rule-set-backdrop" role="presentation" onKeyDown={handleDialogKeys}>
          <section
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

            {!readOnly && onOverride && (
              <section className="rule-set-alternatives" aria-labelledby="alternative-rules-title">
                <div className="rule-set-section-heading">
                  <div>
                    <h3 id="alternative-rules-title">Change the rule set</h3>
                    <p>Closest matches appear first. Alternatives were prepared only after you opened this window.</p>
                  </div>
                </div>

                {selection.mode === 'reviewer_override' && automaticRuleSet && automaticRuleSet.id !== selectedRuleSet?.id && (
                  <button
                    className="restore-automatic-button"
                    type="button"
                    onClick={() => setPendingRuleSetId(automaticRuleSet.id)}
                  >
                    Use automatic selection: {automaticRuleSet.label}
                  </button>
                )}

                <div className="rule-set-option-list" role="list">
                  {alternatives.map((alternative, index) => (
                    <button
                      className={pendingRuleSetId === alternative.ruleSet.id ? 'rule-set-option selected' : 'rule-set-option'}
                      type="button"
                      key={alternative.ruleSet.id}
                      onClick={() => setPendingRuleSetId(alternative.ruleSet.id)}
                      aria-pressed={pendingRuleSetId === alternative.ruleSet.id}
                      title={alternative.ruleSet.description}
                    >
                      <span>{index < 3 ? `Likely alternative ${index + 1}` : 'Other rule set'}</span>
                      <strong>{alternative.ruleSet.label}</strong>
                      <small>{alternative.ruleSet.description}</small>
                    </button>
                  ))}
                </div>

                {pendingRuleSet && (
                  <div className="rule-set-override-confirmation" role="status">
                    <p><strong>Current:</strong> {selectedRuleSet?.label}</p>
                    <p><strong>Replace with:</strong> {pendingRuleSet.label}</p>
                    {pendingAlternative?.conflicts.map((conflict) => <p className="rule-set-conflict" key={conflict}>Application conflict: {conflict}</p>)}
                    <p>Cached OCR text, coordinates, and image evidence will be reused. Staff answers for affected cards will be cleared.</p>
                    <button className="primary-button" type="button" onClick={applyOverride} disabled={reanalyzing}>
                      {reanalyzing ? 'Reanalyzing…' : 'Apply rule set and reanalyze'}
                    </button>
                  </div>
                )}
              </section>
            )}

            {evaluation && (
              <section className="rule-set-current-rules" aria-labelledby="current-rules-title">
                <div className="rule-set-section-heading">
                  <div>
                    <h3 id="current-rules-title">Rules in this set</h3>
                    <p>{evaluation.counts.applies} apply · {evaluation.counts.missing_context} need context · {evaluation.counts.does_not_apply} do not apply</p>
                  </div>
                  <a href={appUrl(`/rules/${evaluation.ruleSet.id}`)} target="_blank" rel="noreferrer">Open full rule set ↗</a>
                </div>
                <div className="rule-detail-list">
                  {evaluation.rules.map((entry) => (
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
              </section>
            )}
          </section>
        </div>
      )}
    </>
  )
}
