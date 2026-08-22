import { parseAlcohol } from './normalization'
import {
  RULE_SET_SPECIFICATIONS,
  RULE_SPECIFICATIONS,
  type ApplicabilityCondition,
  type BeverageType,
  type ReviewFactKey,
  type RuleSetSpecification,
  type RuleSpecification,
} from './ruleSpecification'
import type { ApplicationData } from './reviewSchema'

export type ReviewContext = Partial<Record<ReviewFactKey, unknown>>
export type ApplicabilityStatus = 'applies' | 'does_not_apply' | 'missing_context'

export type RuleApplicability = {
  rule: RuleSpecification
  status: ApplicabilityStatus
  missingFacts: ReviewFactKey[]
  reasons: string[]
}

export type RuleSetEvaluation = {
  ruleSet: RuleSetSpecification
  rules: RuleApplicability[]
  counts: Record<ApplicabilityStatus, number>
}

export type RuleSetSelectionAudit = {
  ruleSetId: string
  mode: 'automatic' | 'reviewer_override'
  selectedAt: string
  reasons: string[]
}

export type RuleSetSelection = {
  status: 'selected' | 'missing_context'
  automaticRuleSetId?: string
  selectedRuleSetId?: string
  mode: 'automatic' | 'reviewer_override'
  reasons: string[]
  conflicts: string[]
  missingFacts: ReviewFactKey[]
  reanalysisMs?: number
  audit: RuleSetSelectionAudit[]
}

export type RankedRuleSet = {
  ruleSet: RuleSetSpecification
  score: number
  reasons: string[]
  conflicts: string[]
}

function hasValue(value: unknown) {
  if (value === undefined || value === null || value === '') return false
  return !Array.isArray(value) || value.length > 0
}

function conditionResult(condition: ApplicabilityCondition, context: ReviewContext) {
  const actual = context[condition.fact]
  if (actual === undefined) return { status: 'missing_context' as const, missingFact: condition.fact }

  if (condition.operator === 'present') {
    return { status: hasValue(actual) ? 'applies' as const : 'does_not_apply' as const }
  }

  if (condition.operator === 'equals') {
    return { status: Object.is(actual, condition.value) ? 'applies' as const : 'does_not_apply' as const }
  }
  if (condition.operator === 'not_equals') {
    return { status: !Object.is(actual, condition.value) ? 'applies' as const : 'does_not_apply' as const }
  }

  const actualNumber = typeof actual === 'number' ? actual : Number(actual)
  const expectedNumber = typeof condition.value === 'number' ? condition.value : Number(condition.value)
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return { status: 'missing_context' as const, missingFact: condition.fact }
  }

  const applies = condition.operator === 'gte'
    ? actualNumber >= expectedNumber
    : condition.operator === 'gt'
      ? actualNumber > expectedNumber
      : actualNumber <= expectedNumber
  return { status: applies ? 'applies' as const : 'does_not_apply' as const }
}

export function evaluateRuleApplicability(
  rule: RuleSpecification,
  context: ReviewContext,
): RuleApplicability {
  const all = rule.appliesWhen.all ?? []
  const any = rule.appliesWhen.any ?? []
  if (!all.length && !any.length) {
    return { rule, status: 'applies', missingFacts: [], reasons: [rule.appliesWhen.description] }
  }

  const allResults = all.map((condition) => ({ condition, ...conditionResult(condition, context) }))
  const anyResults = any.map((condition) => ({ condition, ...conditionResult(condition, context) }))
  const missingFacts = [...new Set(
    [...allResults, ...anyResults]
      .flatMap((result) => result.status === 'missing_context' && result.missingFact ? [result.missingFact] : []),
  )]

  if (allResults.some((result) => result.status === 'does_not_apply')) {
    return { rule, status: 'does_not_apply', missingFacts: [], reasons: [rule.appliesWhen.description] }
  }
  if (anyResults.some((result) => result.status === 'applies') && allResults.every((result) => result.status === 'applies')) {
    return { rule, status: 'applies', missingFacts: [], reasons: [rule.appliesWhen.description] }
  }
  if (!any.length && allResults.every((result) => result.status === 'applies')) {
    return { rule, status: 'applies', missingFacts: [], reasons: [rule.appliesWhen.description] }
  }
  if (any.length && anyResults.every((result) => result.status === 'does_not_apply')) {
    return { rule, status: 'does_not_apply', missingFacts: [], reasons: [rule.appliesWhen.description] }
  }
  return {
    rule,
    status: 'missing_context',
    missingFacts,
    reasons: [`${rule.appliesWhen.description} Missing: ${missingFacts.join(', ')}.`],
  }
}

export function evaluateRuleSet(ruleSetId: string, context: ReviewContext): RuleSetEvaluation | undefined {
  const ruleSet = RULE_SET_SPECIFICATIONS.find((candidate) => candidate.id === ruleSetId)
  if (!ruleSet) return undefined
  const ids = [...ruleSet.baseRuleIds, ...ruleSet.conditionalRuleIds]
  const rules = ids.flatMap((id) => {
    const rule = RULE_SPECIFICATIONS.find((candidate) => candidate.id === id)
    return rule ? [evaluateRuleApplicability(rule, context)] : []
  })
  return {
    ruleSet,
    rules,
    counts: {
      applies: rules.filter((rule) => rule.status === 'applies').length,
      does_not_apply: rules.filter((rule) => rule.status === 'does_not_apply').length,
      missing_context: rules.filter((rule) => rule.status === 'missing_context').length,
    },
  }
}

export function reviewContextFromApplication(application: ApplicationData): ReviewContext {
  const alcohol = parseAlcohol(application.alcoholContent).abv
  return {
    productType: application.productType,
    source: application.source,
    alcoholContent: alcohol ?? undefined,
    containerVolumeMl: application.containerVolumeMl,
    brandName: application.brandName,
    applicationType: application.applicationType,
    distinctiveBottleRequested: application.distinctiveBottleRequested,
    destinationState: application.destinationState,
    fancifulName: application.fancifulName,
    applicantName: application.applicantName,
    applicantAddress: application.applicantAddress,
    permitName: application.permitName,
    permitAddress: application.permitAddress,
    formulaRequired: application.formulaRequired,
    formulaId: application.formulaId,
    formulaClassType: application.formulaClassType,
    formulaCompositionStatement: application.formulaCompositionStatement,
    formulaLabelingInstructions: application.formulaLabelingInstructions,
    labelClassType: application.classType,
    netContents: application.netContents,
    labelDimensions: application.labelDimensions,
    labelSet: application.labelSet,
    bottleMarkings: application.bottleMarkings,
    bottleDesignEvidence: application.bottleDesignEvidence,
    labelAlcoholStatementPresent: application.labelAlcoholStatementPresent,
    containsSignificantSolids: application.containsSignificantSolids,
    containsNeutralSpirits: application.containsNeutralSpirits,
    requiresAgeStatement: application.requiresAgeStatement,
    spiritsAgeOrMaturityClaim: application.spiritsAgeOrMaturityClaim,
    requiresWoodTreatmentDisclosure: application.requiresWoodTreatmentDisclosure,
    requiresStateOfDistillation: application.requiresStateOfDistillation,
    containsYellow5: application.containsYellow5,
    containsCochinealOrCarmine: application.containsCochinealOrCarmine,
    sulfitesPpm: application.sulfitesPpm,
    containsAspartame: application.containsAspartame,
    wineAppellation: application.wineAppellation,
    wineAppellationType: application.wineAppellationType,
    wineAppellationPercentage: application.wineAppellationPercentage,
    wineFinishedInRequiredArea: application.wineFinishedInRequiredArea,
    wineVarietals: application.wineVarietals,
    wineVintage: application.wineVintage,
    wineVintagePercentage: application.wineVintagePercentage,
    wineEstateBottledClaim: application.wineEstateBottledClaim,
    wineEstateProductionContinuous: application.wineEstateProductionContinuous,
    wineForeignLawCompliant: application.wineForeignLawCompliant,
    wineForeignBlendReferenced: application.wineForeignBlendReferenced,
    wineForeignPercentage: application.wineForeignPercentage,
    maltAlcoholFromAddedIngredients: application.maltAlcoholFromAddedIngredients,
    maltAlcoholCharacterizationClaim: application.maltAlcoholCharacterizationClaim,
    maltGeographicClaim: application.maltGeographicClaim,
    maltSpecialtyProduct: application.maltSpecialtyProduct,
    maltPostImportBottling: application.maltPostImportBottling,
    importCountryOfOrigin: application.importCountryOfOrigin,
    importBottlingDisposition: application.importBottlingDisposition,
    productionFacts: application.productionFacts,
  }
}

function automaticRuleSetId(context: ReviewContext) {
  const productType = context.productType as BeverageType | undefined
  const source = context.source
  if (!productType) return { missingFacts: ['productType'] as ReviewFactKey[] }
  if (productType === 'wine') {
    if (typeof context.alcoholContent !== 'number') {
      return { missingFacts: ['alcoholContent'] as ReviewFactKey[] }
    }
    if (context.alcoholContent < 7) return { id: 'wine-under-7-ttb-routing', missingFacts: [] }
  }
  if (source !== 'domestic' && source !== 'imported') {
    return { missingFacts: ['source'] as ReviewFactKey[] }
  }
  const id = productType === 'distilled_spirits'
    ? `distilled-spirits-${source}`
    : productType === 'wine'
      ? `wine-7plus-${source}`
      : `malt-beverage-${source}`
  return { id, missingFacts: [] }
}

function factsForRuleSet(ruleSet: RuleSetSpecification, context: ReviewContext) {
  const reasons: string[] = []
  const conflicts: string[] = []
  const productType = context.productType
  const source = context.source
  const alcohol = context.alcoholContent

  if (productType === ruleSet.productType) reasons.push(`Product type: ${ruleSet.label.split(' — ')[0]}`)
  else if (productType) conflicts.push(`Application product type is ${String(productType).replaceAll('_', ' ')}.`)
  if (ruleSet.source === 'either') reasons.push('Domestic/imported source does not change this routing branch.')
  else if (source === ruleSet.source) reasons.push(`Source: ${ruleSet.source === 'domestic' ? 'Domestic' : 'Imported'}`)
  else if (source) conflicts.push(`Application source is ${String(source)}.`)
  if (ruleSet.id.startsWith('wine-7plus')) {
    if (typeof alcohol === 'number' && alcohol >= 7) reasons.push(`Alcohol content: ${alcohol}% (7% or more)`)
    else if (typeof alcohol === 'number') conflicts.push(`Application alcohol content is ${alcohol}%, below the 7% COLA threshold.`)
  }
  if (ruleSet.id === 'wine-under-7-ttb-routing') {
    if (typeof alcohol === 'number' && alcohol < 7) reasons.push(`Alcohol content: ${alcohol}% (below 7%)`)
    else if (typeof alcohol === 'number') conflicts.push(`Application alcohol content is ${alcohol}%, not below 7%.`)
  }
  return { reasons, conflicts }
}

export function selectAutomaticRuleSet(context: ReviewContext, selectedAt = new Date().toISOString()): RuleSetSelection {
  const automatic = automaticRuleSetId(context)
  if (!automatic.id) {
    return {
      status: 'missing_context',
      mode: 'automatic',
      reasons: ['SODAPOP needs more application context before selecting a rule set.'],
      conflicts: [],
      missingFacts: automatic.missingFacts,
      audit: [],
    }
  }
  const ruleSet = RULE_SET_SPECIFICATIONS.find((candidate) => candidate.id === automatic.id)!
  const { reasons, conflicts } = factsForRuleSet(ruleSet, context)
  return {
    status: 'selected',
    automaticRuleSetId: ruleSet.id,
    selectedRuleSetId: ruleSet.id,
    mode: 'automatic',
    reasons,
    conflicts,
    missingFacts: [],
    audit: [{ ruleSetId: ruleSet.id, mode: 'automatic', selectedAt, reasons }],
  }
}

export function overrideRuleSet(
  previous: RuleSetSelection,
  context: ReviewContext,
  ruleSetId: string,
  selectedAt = new Date().toISOString(),
): RuleSetSelection {
  const ruleSet = RULE_SET_SPECIFICATIONS.find((candidate) => candidate.id === ruleSetId)
  if (!ruleSet) return previous
  const { reasons, conflicts } = factsForRuleSet(ruleSet, context)
  const overrideReasons = [`Reviewer selected ${ruleSet.label}.`, ...reasons]
  return {
    status: 'selected',
    automaticRuleSetId: previous.automaticRuleSetId,
    selectedRuleSetId: ruleSet.id,
    mode: ruleSet.id === previous.automaticRuleSetId ? 'automatic' : 'reviewer_override',
    reasons: overrideReasons,
    conflicts,
    missingFacts: [],
    audit: [
      ...previous.audit,
      { ruleSetId: ruleSet.id, mode: 'reviewer_override', selectedAt, reasons: overrideReasons },
    ],
  }
}

export function rankAlternativeRuleSets(context: ReviewContext, currentRuleSetId?: string): RankedRuleSet[] {
  return RULE_SET_SPECIFICATIONS
    .filter((ruleSet) => ruleSet.id !== currentRuleSetId)
    .map((ruleSet) => {
      const { reasons, conflicts } = factsForRuleSet(ruleSet, context)
      let score = 0
      if (context.productType === ruleSet.productType) score += 60
      if (ruleSet.source === 'either' || context.source === ruleSet.source) score += 25
      if (ruleSet.id.startsWith('wine-7plus') && typeof context.alcoholContent === 'number' && context.alcoholContent >= 7) score += 15
      if (ruleSet.id === 'wine-under-7-ttb-routing' && typeof context.alcoholContent === 'number' && context.alcoholContent < 7) score += 15
      return { ruleSet, score: score - conflicts.length * 10, reasons, conflicts }
    })
    .sort((left, right) => right.score - left.score || left.ruleSet.label.localeCompare(right.ruleSet.label))
}
