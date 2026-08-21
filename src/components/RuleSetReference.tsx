import { RULE_SET_SPECIFICATIONS, RULE_SPECIFICATIONS } from '../domain/ruleSpecification'

export function RuleSetReference({ ruleSetId }: { ruleSetId: string }) {
  const ruleSet = RULE_SET_SPECIFICATIONS.find((candidate) => candidate.id === ruleSetId)
  if (!ruleSet) return null
  const baseRules = ruleSet.baseRuleIds.flatMap((id) => {
    const rule = RULE_SPECIFICATIONS.find((candidate) => candidate.id === id)
    return rule ? [rule] : []
  })
  const conditionalRules = ruleSet.conditionalRuleIds.flatMap((id) => {
    const rule = RULE_SPECIFICATIONS.find((candidate) => candidate.id === id)
    return rule ? [rule] : []
  })

  return (
    <section className="rule-reference-page" aria-labelledby="rule-reference-title">
      <header>
        <p className="eyebrow">SODAPOP rule reference</p>
        <h1 id="rule-reference-title">{ruleSet.label}</h1>
        <p>{ruleSet.description}</p>
        <dl>
          <div><dt>Review path</dt><dd>{ruleSet.jurisdiction === 'full_cola_review' ? 'Full TTB COLA review' : 'TTB non-COLA routing and label checks'}</dd></div>
          <div><dt>Selection facts</dt><dd>{ruleSet.selectionFacts.join(', ')}</dd></div>
          <div><dt>Total rules</dt><dd>{baseRules.length + conditionalRules.length}</dd></div>
        </dl>
      </header>

      <RuleReferenceGroup title="Base rules" description="Evaluated for every review in this regulatory branch." rules={baseRules} />
      <RuleReferenceGroup title="Conditional rules" description="Activated only when application, formula, production, or label facts meet their conditions." rules={conditionalRules} />
    </section>
  )
}

function RuleReferenceGroup({
  title,
  description,
  rules,
}: {
  title: string
  description: string
  rules: typeof RULE_SPECIFICATIONS[number][]
}) {
  return (
    <section className="rule-reference-group">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="rule-reference-list">
        {rules.map((rule) => (
          <article key={rule.id} id={rule.id}>
            <p className="rule-reference-id">{rule.id}</p>
            <h3>{rule.title}</h3>
            <p>{rule.requirement}</p>
            <dl>
              <div><dt>Applies when</dt><dd>{rule.appliesWhen.description}</dd></div>
              <div><dt>Evidence</dt><dd>{rule.evidenceSources.join(', ')}</dd></div>
              <div><dt>Missing context</dt><dd>{rule.missingContext}</dd></div>
              <div><dt>Authority</dt><dd>{rule.authorities.join(' · ')}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}
