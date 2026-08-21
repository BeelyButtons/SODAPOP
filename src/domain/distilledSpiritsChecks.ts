import { bestObservedLine, normalizeWords, similarity } from './normalization'
import type { ApplicationData, CheckStatus, HighlightRegion, ReviewCheck } from './reviewSchema'
import { evaluateRuleSet, type RuleApplicability } from './ruleEngine'

type CoreCheckId = 'brand' | 'classType' | 'alcohol' | 'netContents' | 'warningText' | 'warningFormat'

type Input = {
  application: ApplicationData
  ocrText: string
  ocrConfidence: number
  ruleSetId: 'distilled-spirits-domestic' | 'distilled-spirits-imported'
  coreChecks: Record<CoreCheckId, ReviewCheck>
}

const coreRuleChecks: Record<string, CoreCheckId> = {
  'common.health-warning-wording': 'warningText',
  'common.health-warning-format': 'warningFormat',
  'spirits.brand-name': 'brand',
  'spirits.class-type-designation': 'classType',
  'spirits.alcohol-content': 'alcohol',
  'spirits.net-contents': 'netContents',
}

const findingLabels: Record<CheckStatus, string> = {
  pass: 'Pass',
  mismatch: 'Mismatch',
  needs_review: 'Human review',
}

function observedPhrase(phrase: string, text: string) {
  const normalizedPhrase = normalizeWords(phrase)
  if (normalizeWords(text).includes(normalizedPhrase)) return phrase
  return bestObservedLine(phrase, text)
}

function phraseMatches(phrase: string, text: string) {
  const observed = observedPhrase(phrase, text)
  return normalizeWords(text).includes(normalizeWords(phrase)) || similarity(phrase, observed) >= 0.86
}

function card(
  rule: RuleApplicability,
  status: CheckStatus,
  observed: string,
  explanation: string,
  requirements?: string[],
  evidence?: Pick<ReviewCheck, 'applicabilityExplanation' | 'applicationEvidence' | 'labelEvidence'>,
): ReviewCheck {
  return {
    id: rule.rule.id,
    ruleId: rule.rule.id,
    label: rule.rule.title,
    status,
    expected: rule.rule.requirement,
    requirements,
    observed,
    explanation,
    ...evidence,
  }
}

function combinedHighlight(checks: ReviewCheck[]): HighlightRegion | undefined {
  const regions = checks.flatMap((check) => check.highlight ? [check.highlight] : [])
  const first = regions[0]
  if (!first) return undefined
  const compatible = regions.filter((region) => (
    region.imageWidth === first.imageWidth && region.imageHeight === first.imageHeight
  ))
  return {
    imageWidth: first.imageWidth,
    imageHeight: first.imageHeight,
    boxes: compatible.flatMap((region) => region.boxes),
  }
}

function missingContextCard(rule: RuleApplicability) {
  const missing = rule.missingFacts.length ? rule.missingFacts.join(', ') : 'required review evidence'
  return card(
    rule,
    'needs_review',
    `Missing context: ${missing}`,
    `${rule.rule.missingContext} SODAPOP did not treat missing information as “does not apply.”`,
  )
}

function textEvidenceCard(
  rule: RuleApplicability,
  text: string,
  confidence: number,
  phrases: string[],
  explanation: string,
) {
  const expectedPhrases = phrases.map((phrase) => phrase.trim()).filter(Boolean)
  if (!expectedPhrases.length) return missingContextCard(rule)
  const missing = expectedPhrases.filter((phrase) => !phraseMatches(phrase, text))
  const observed = expectedPhrases
    .map((phrase) => observedPhrase(phrase, text))
    .filter(Boolean)
    .join(' · ') || 'Not found'
  if (!missing.length) {
    return card(rule, 'pass', observed, explanation, expectedPhrases)
  }
  if (confidence < 68) {
    return card(
      rule,
      'needs_review',
      observed,
      `OCR could not reliably confirm: ${missing.join('; ')}. Inspect the artwork before deciding.`,
      expectedPhrases,
    )
  }
  return card(
    rule,
    'mismatch',
    missing.length === expectedPhrases.length ? 'Required statement not found' : observed,
    `Readable OCR did not contain the statement${missing.length > 1 ? 's' : ''} required by the application or supporting information: ${missing.join('; ')}.`,
    expectedPhrases,
  )
}

function nameAddressCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const name = application.permitName || application.applicantName
  const address = application.permitAddress || application.applicantAddress
  if (!name || !address) return missingContextCard(rule)
  const authorizedPhrases = application.source === 'imported'
    ? ['IMPORTED BY', 'SOLE AGENT', 'SOLE U.S. AGENT', 'IMPORTED AND BOTTLED BY']
    : ['BOTTLED BY', 'DISTILLED BY', 'PRODUCED AND BOTTLED BY', 'DISTILLED AND BOTTLED BY']
  const phrase = authorizedPhrases.find((candidate) => phraseMatches(candidate, text))
  const missing = [name, address].filter((value) => !phraseMatches(value, text))
  if (!phrase) missing.unshift(`authorized ${application.source} responsibility phrase`)
  if (!missing.length) {
    return card(
      rule,
      'pass',
      `${phrase} ${name}, ${address}`,
      'The responsibility phrase, permit name, and city/State match the application information. Formatting remains visible for staff confirmation.',
      [`Authorized ${application.source} responsibility phrase`, name, address],
    )
  }
  const status: CheckStatus = confidence < 68 ? 'needs_review' : 'mismatch'
  return card(
    rule,
    status,
    'Required responsibility statement was not fully matched',
    `${status === 'mismatch' ? 'Readable OCR conflicts with or omits' : 'OCR could not reliably resolve'}: ${missing.join('; ')}.`,
    [`Authorized ${application.source} responsibility phrase`, name, address],
  )
}

function sameFieldCard(rule: RuleApplicability, coreChecks: Input['coreChecks']) {
  const fieldChecks = [coreChecks.brand, coreChecks.classType, coreChecks.alcohol]
  const highlight = combinedHighlight(fieldChecks)
  const evidence = {
    applicabilityExplanation: 'Distilled-spirits brand name, class/type designation, and alcohol content must appear in the same field of vision.',
    applicationEvidence: fieldChecks.map((check) => `${check.label}: ${check.expected}`).join(' · '),
    labelEvidence: fieldChecks.map((check) => `${check.label}: ${check.observed || 'Not found'} (${findingLabels[check.status]})`).join(' · '),
  }
  if (fieldChecks.every((check) => check.status === 'pass' && check.highlight)) {
    return {
      ...card(
      rule,
      'pass',
      'Brand name, class/type, and alcohol content were located on this submitted label face.',
      'All three required statements were located together. Hovering this card highlights all three regions at once.',
      undefined,
      evidence,
      ),
      highlight,
    }
  }
  const mismatches = fieldChecks.filter((check) => check.status === 'mismatch')
  const unresolved = fieldChecks.filter((check) => check.status === 'needs_review')
  if (mismatches.length) {
    return {
      ...card(
      rule,
      'mismatch',
      `Problem with: ${mismatches.map((check) => check.label).join(', ')}.`,
      `SODAPOP could not establish the shared field of vision because ${mismatches.map((check) => `${check.label.toLowerCase()} is missing or conflicts with the application`).join('; ')}. Detected evidence remains highlighted for inspection.`,
      undefined,
      evidence,
      ),
      highlight,
    }
  }
  return {
    ...card(
    rule,
    'needs_review',
    `Unresolved: ${unresolved.map((check) => check.label).join(', ') || 'statement locations'}.`,
    `OCR could not reliably establish ${unresolved.map((check) => check.label.toLowerCase()).join(', ') || 'all three locations'}. Confirm all three statements can be viewed without turning the container.`,
    undefined,
    evidence,
    ),
    highlight,
  }
}

function countryOriginCard(rule: RuleApplicability, application: ApplicationData, text: string) {
  const expected = application.importCountryOfOrigin
  if (!expected) return missingContextCard(rule)
  const detected = text.match(/\b(?:product|produce)\s+of\s+([a-z][a-z ]{2,35})/i)?.[1]
    ?.split(/\s{2,}|\n|imported|government/i)[0]
    ?.trim()
  if (!detected) {
    return card(
      rule,
      'needs_review',
      'Country-of-origin statement was not readable in OCR.',
      'Inspect the origin area. SODAPOP cannot distinguish an absent statement from text hidden by glare, blur, or obstruction.',
      [`PRODUCT OF ${expected}`],
    )
  }
  if (normalizeWords(detected).startsWith(normalizeWords(expected))) {
    return card(rule, 'pass', `PRODUCT OF ${detected}`, 'The country-of-origin statement matches the imported-product application information.', [`PRODUCT OF ${expected}`])
  }
  return card(
    rule,
    'mismatch',
    `PRODUCT OF ${detected}`,
    `The detected country conflicts with the application country, ${expected}.`,
    [`PRODUCT OF ${expected}`],
  )
}

function optionalInformationCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const claimPatterns = [
    /\bsmall batch\b/i,
    /\b(?:aged|old)\s+(?:at least\s+)?\d+\s+(?:years?|months?)/i,
    /\b(?:organic|natural|handmade|estate|reserve)\b/i,
  ]
  const claims = claimPatterns.flatMap((pattern) => text.match(pattern)?.[0] ?? [])
  if (!claims.length && confidence >= 68) {
    return card(
      rule,
      'pass',
      'No material optional claim was detected.',
      'No unsupported optional textual claim was identified in the readable OCR evidence.',
      undefined,
      {
        applicabilityExplanation: 'Optional statements are checked when readable label text includes a production, quality, age, or similar claim.',
        applicationEvidence: 'No supporting comparison was needed because no material optional claim was detected.',
        labelEvidence: 'Readable OCR did not identify a material optional claim.',
      },
    )
  }
  const supportingFacts = [
    application.productionFacts,
    application.formulaCompositionStatement,
    application.formulaLabelingInstructions,
    application.classType,
  ].filter(Boolean).join(' · ')
  const facts = normalizeWords(supportingFacts)
  const unsupported = claims.filter((claim) => {
    const normalizedClaim = normalizeWords(claim)
    if (/aged|old/.test(normalizedClaim) && /aged|youngest/.test(facts)) return false
    return !facts.includes(normalizedClaim)
  })
  if (!unsupported.length && claims.length) {
    return card(
      rule,
      'pass',
      claims.join(' · '),
      'Each detected optional claim has corresponding support in the application or supporting information shown below.',
      undefined,
      {
        applicabilityExplanation: `The label contains the optional claim${claims.length > 1 ? 's' : ''}: ${claims.join('; ')}.`,
        applicationEvidence: supportingFacts || 'No supporting application fact was supplied.',
        labelEvidence: claims.join(' · '),
      },
    )
  }
  return card(
    rule,
    'needs_review',
    claims.length ? claims.join(' · ') : 'OCR was not sufficiently readable to inventory claims.',
    unsupported.length
      ? `Supporting evidence was not found for: ${unsupported.join('; ')}. Confirm truthfulness and whether more documentation is required.`
      : 'Inspect graphics and any text OCR could not read; no automatic failure was inferred from poor image quality.',
    undefined,
    {
      applicabilityExplanation: claims.length
        ? `The label contains the optional claim${claims.length > 1 ? 's' : ''}: ${claims.join('; ')}.`
        : 'Image quality prevented a reliable inventory of optional statements.',
      applicationEvidence: supportingFacts || 'No supporting application fact was supplied.',
      labelEvidence: claims.length ? claims.join(' · ') : 'Optional label text was not readable enough to inventory.',
    },
  )
}

type ParsedAge = {
  amount: number
  unit: 'day' | 'month' | 'year'
  text: string
  isMaximum: boolean
  isExclusiveMinimum: boolean
}

function singularAgeUnit(value: string): ParsedAge['unit'] {
  if (value.toLowerCase().startsWith('year')) return 'year'
  if (value.toLowerCase().startsWith('month')) return 'month'
  return 'day'
}

function parseDocumentedAge(facts: string): ParsedAge | undefined {
  const match = facts.match(
    /(?:youngest(?: applicable)? spirit (?:is |was )?aged|youngest age:)\s*(\d+)\s*(years?|months?|days?)/i,
  )
  if (!match) return undefined
  return {
    amount: Number(match[1]),
    unit: singularAgeUnit(match[2]),
    text: match[0],
    isMaximum: false,
    isExclusiveMinimum: false,
  }
}

function parseLabelAge(text: string): ParsedAge | undefined {
  const maximum = text.match(
    /\b(?:aged\s+(?:for\s+)?less\s+than\s+\d+\s+(?:years?|months?|days?)|under\s+\d+\s+(?:years?|months?|days?)\s+old|aged\s+not\s+more\s+than\s+\d+\s+(?:years?|months?|days?))\b/i,
  )?.[0]
  const accepted = text.match(
    /\b(?:aged(?:\s+at\s+least|\s+a\s+minimum\s+of|\s+not\s+less\s+than)?\s+\d+\s+(?:years?|months?|days?)|over\s+\d+\s+(?:years?|months?|days?)\s+old|\d+\s+(?:years?|months?|days?)\s+old)\b/i,
  )?.[0]
  const detected = maximum || accepted
  const value = detected?.match(/(\d+)\s+(years?|months?|days?)/i)
  if (!detected || !value) return undefined
  return {
    amount: Number(value[1]),
    unit: singularAgeUnit(value[2]),
    text: detected,
    isMaximum: Boolean(maximum),
    isExclusiveMinimum: /^over\b/i.test(detected),
  }
}

function comparableAgeValue(age: ParsedAge) {
  if (age.unit === 'year') return age.amount * 12
  if (age.unit === 'month') return age.amount
  return undefined
}

function ageCard(rule: RuleApplicability, application: ApplicationData, text: string) {
  const facts = application.productionFacts ?? ''
  const documented = parseDocumentedAge(facts)
  if (!documented) return missingContextCard(rule)
  const accepted = [
    '“__ years/months/days old”',
    '“Aged __ years/months/days”',
    '“Aged at least __” or “Aged a minimum of __”',
    '“Over __ years old” or “Aged not less than __”',
    'Formula-supported whisky percentage-and-age forms, when applicable',
  ]
  const detected = parseLabelAge(text)
  const documentedValue = comparableAgeValue(documented)
  const detectedValue = detected ? comparableAgeValue(detected) : undefined
  const comparable = documented.unit === detected?.unit || (documentedValue !== undefined && detectedValue !== undefined)
  const overstatesAge = comparable && detectedValue !== undefined && documentedValue !== undefined
    ? detectedValue > documentedValue || (detected?.isExclusiveMinimum === true && detectedValue === documentedValue)
    : comparable && detected
      ? detected.amount > documented.amount || (detected.isExclusiveMinimum && detected.amount === documented.amount)
      : false
  const straightWhiskyMinimumConflict = Boolean(
    detected
    && application.source === 'domestic'
    && /\bstraight\b.*\bwhisk(?:y|ey)\b/i.test(application.classType)
    && (detected.unit === 'year'
      ? detected.amount < 2
      : detected.unit === 'month'
        ? detected.amount < 24
        : detected.amount < 730),
  )
  const ageEvidence = {
    applicabilityExplanation: application.requiresAgeStatement
      ? 'The application indicates that an age statement is mandatory for this product.'
      : 'The label or application makes an age or maturity representation, so the statement must be checked.',
    applicationEvidence: `Youngest applicable spirit: ${documented.amount} ${documented.unit}${documented.amount === 1 ? '' : 's'}.`,
    labelEvidence: detected?.text || 'No readable age statement was detected.',
  }
  if (detected?.isMaximum) return {
    ...card(rule, 'mismatch', detected.text, 'The label uses a maximum-age statement. TTB permits minimum ages and age understatement, but not maximum-age wording.', accepted, ageEvidence),
    requirementsLabel: 'Allowable forms — one is required when this rule applies',
  }
  if (detected && straightWhiskyMinimumConflict) return {
    ...card(rule, 'mismatch', detected.text, 'Although age may generally be understated, this statement conflicts with the minimum aging inherent in the domestic straight-whisky designation.', accepted, ageEvidence),
    requirementsLabel: 'Allowable forms — one is required when this rule applies',
  }
  if (detected && comparable && !overstatesAge) return {
    ...card(rule, 'pass', detected.text, detectedValue === documentedValue
      ? 'The age statement agrees with the documented youngest applicable spirit.'
      : 'The statement permissibly understates, and does not overstate, the documented age of the youngest applicable spirit.', accepted, ageEvidence),
    requirementsLabel: 'Accepted forms — one is required',
  }
  return {
    ...card(
    rule,
    detected && comparable ? 'mismatch' : 'needs_review',
    detected?.text || 'Supporting age statement not matched',
    detected && comparable
      ? `The statement overstates the documented youngest applicable spirit of ${documented.amount} ${documented.unit}${documented.amount === 1 ? '' : 's'}.`
      : detected
        ? 'The artwork and application express age in units that cannot be compared reliably from the supplied facts. Confirm the underlying storage dates before deciding.'
        : `OCR did not reliably resolve an age statement for the documented ${documented.amount} ${documented.unit}${documented.amount === 1 ? '' : 's'}. Inspect the artwork before deciding; absence from OCR alone is not a confirmed label mismatch.`,
    accepted,
    ageEvidence,
    ),
    requirementsLabel: 'Accepted forms — one is required',
  }
}

function productionDisclosure(
  rule: RuleApplicability,
  application: ApplicationData,
  text: string,
  confidence: number,
  factLabel: string,
  fallback?: string,
) {
  const expression = new RegExp(`${factLabel}:\\s*([^.;]+)`, 'i')
  const expected = application.productionFacts?.match(expression)?.[1]?.trim() || fallback
  return textEvidenceCard(rule, text, confidence, expected ? [expected] : [], `The label disclosure matches the documented ${factLabel.toLowerCase()}.`)
}

function evaluatedRuleCard(rule: RuleApplicability, input: Input): ReviewCheck {
  if (rule.status === 'missing_context') return missingContextCard(rule)
  const { application, ocrText, ocrConfidence, coreChecks } = input
  switch (rule.rule.id) {
    case 'common.label-set-completeness':
      return application.labelSet === true && Boolean(application.labelDimensions) && application.bottleMarkings !== undefined
        ? card(
            rule,
            'pass',
            'The application identifies a complete label set and documents its dimensions and container markings.',
            'The evidence needed to understand which label panels and container-applied markings were submitted is identified below.',
            undefined,
            {
              applicabilityExplanation: 'Every review needs enough submitted label and container evidence to evaluate all mandatory information.',
              applicationEvidence: `Label set supplied: yes · Dimensions: ${application.labelDimensions} · Container markings: ${application.bottleMarkings || 'None documented'}`,
              labelEvidence: `Current artwork OCR confidence: ${Math.round(ocrConfidence)}%. Confirm that every submitted panel and container-applied marking is represented.`,
            },
          )
        : application.labelSet === true
          ? card(
              rule,
              'needs_review',
              'The application says a label set was supplied, but its dimensions or container-marking evidence is incomplete.',
              'Confirm the submitted panels and any container-applied markings before deciding.',
              undefined,
              {
                applicabilityExplanation: 'Every review needs enough submitted label and container evidence to evaluate all mandatory information.',
                applicationEvidence: `Label set supplied: yes · Dimensions: ${application.labelDimensions || 'Not supplied'} · Container markings: ${application.bottleMarkings ?? 'Not supplied'}`,
                labelEvidence: `Current artwork OCR confidence: ${Math.round(ocrConfidence)}%.`,
              },
            )
        : application.labelSet === false
          ? card(rule, 'mismatch', 'Application indicates an incomplete label set.', 'Required label or container evidence is absent from the submitted application information.')
          : missingContextCard(rule)
    case 'common.optional-information':
      return optionalInformationCard(rule, application, ocrText, ocrConfidence)
    case 'common.formula-labeling-instructions':
      return textEvidenceCard(
        rule,
        ocrText,
        ocrConfidence,
        application.formulaLabelingInstructions?.split('|') ?? [],
        'Every required formula labeling instruction was located in the artwork.',
      )
    case 'common.exemption-eligibility':
      return application.source === 'imported'
        ? card(rule, 'mismatch', 'Imported product', 'A certificate of exemption is unavailable for distilled spirits imported in bottles.')
        : card(rule, 'pass', 'Domestic distilled spirits', 'The product/source branch is eligible to continue to State-limitation review.')
    case 'common.exemption-state-limitation':
      return textEvidenceCard(rule, ocrText, ocrConfidence, application.destinationState ? [`FOR SALE IN ${application.destinationState} ONLY`] : [], 'The intrastate limitation matches the destination State.')
    case 'spirits.same-field-of-vision':
      return sameFieldCard(rule, coreChecks)
    case 'spirits.name-address':
      return nameAddressCard(rule, application, ocrText, ocrConfidence)
    case 'spirits.country-of-origin':
      return countryOriginCard(rule, application, ocrText)
    case 'spirits.distinctive-bottle':
      return application.bottleDesignEvidence
        ? card(rule, 'pass', application.bottleDesignEvidence, 'The requested bottle views and design evidence are documented in the supporting application information.')
        : missingContextCard(rule)
    case 'spirits.specialty-composition':
      return textEvidenceCard(rule, ocrText, ocrConfidence, [application.fancifulName ?? '', application.formulaCompositionStatement ?? ''], 'The fanciful name and statement of composition match the application and approved formula.')
    case 'spirits.significant-solids-alcohol': {
      const abv = application.alcoholContent.match(/\d+(?:\.\d+)?/)?.[0]
      return textEvidenceCard(rule, ocrText, ocrConfidence, abv ? [`BOTTLED AT ${abv} PERCENT ALCOHOL BY VOLUME`] : [], 'The special bottling-strength statement matches the application ABV.')
    }
    case 'spirits.neutral-spirits-commodity':
      return textEvidenceCard(rule, ocrText, ocrConfidence, application.formulaLabelingInstructions?.split('|') ?? [], 'The required neutral-spirits percentage and commodity disclosure match the formula instructions.')
    case 'spirits.age-statement':
      return ageCard(rule, application, ocrText)
    case 'spirits.wood-treatment':
      return productionDisclosure(rule, application, ocrText, ocrConfidence, 'Wood treatment disclosure', 'COLORED AND FLAVORED WITH WOOD')
    case 'spirits.state-of-distillation':
      return productionDisclosure(rule, application, ocrText, ocrConfidence, 'State of distillation')
    case 'spirits.yellow-5':
      return textEvidenceCard(rule, ocrText, ocrConfidence, ['CONTAINS FD&C YELLOW NO. 5'], 'The specific color-additive declaration was located.')
    case 'spirits.cochineal-carmine': {
      const colorEvidence = `${application.formulaLabelingInstructions ?? ''} ${application.productionFacts ?? ''}`
      const declaration = /cochineal/i.test(colorEvidence)
        ? 'CONTAINS COCHINEAL EXTRACT'
        : /carmine/i.test(colorEvidence)
          ? 'CONTAINS CARMINE'
          : undefined
      if (!declaration) return missingContextCard(rule)
      return textEvidenceCard(rule, ocrText, ocrConfidence, [declaration], 'The specific color-additive declaration was located.')
    }
    case 'spirits.sulfites':
      return textEvidenceCard(rule, ocrText, ocrConfidence, ['CONTAINS SULFITES'], 'An authorized sulfite declaration was located.')
    case 'spirits.aspartame':
      return textEvidenceCard(rule, ocrText, ocrConfidence, ['PHENYLKETONURICS: CONTAINS PHENYLALANINE'], 'The prescribed uppercase aspartame declaration was located.')
    default:
      return card(rule, 'needs_review', 'No specialized evaluator is available.', 'Review the cited requirement and evidence directly.')
  }
}

export function distilledSpiritsChecks(input: Input) {
  const selectedSource = input.ruleSetId === 'distilled-spirits-imported' ? 'imported' : 'domestic'
  const effectiveInput: Input = {
    ...input,
    application: { ...input.application, source: selectedSource },
  }
  const evaluation = evaluateRuleSet(input.ruleSetId, {
    productType: input.application.productType,
    source: selectedSource,
    applicationType: input.application.applicationType,
    distinctiveBottleRequested: input.application.distinctiveBottleRequested,
    destinationState: input.application.destinationState,
    alcoholContent: Number(input.application.alcoholContent.match(/\d+(?:\.\d+)?/)?.[0]),
    containerVolumeMl: input.application.containerVolumeMl,
    brandName: input.application.brandName,
    fancifulName: input.application.fancifulName,
    applicantName: input.application.applicantName,
    applicantAddress: input.application.applicantAddress,
    permitName: input.application.permitName,
    permitAddress: input.application.permitAddress,
    formulaRequired: input.application.formulaRequired,
    formulaId: input.application.formulaId,
    formulaClassType: input.application.formulaClassType,
    formulaCompositionStatement: input.application.formulaCompositionStatement,
    formulaLabelingInstructions: input.application.formulaLabelingInstructions,
    labelClassType: input.application.classType,
    netContents: input.application.netContents,
    labelDimensions: input.application.labelDimensions,
    labelSet: input.application.labelSet,
    bottleMarkings: input.application.bottleMarkings,
    bottleDesignEvidence: input.application.bottleDesignEvidence,
    labelAlcoholStatementPresent: true,
    containsSignificantSolids: input.application.containsSignificantSolids,
    containsNeutralSpirits: input.application.containsNeutralSpirits,
    requiresAgeStatement: input.application.requiresAgeStatement,
    spiritsAgeOrMaturityClaim: input.application.spiritsAgeOrMaturityClaim,
    requiresWoodTreatmentDisclosure: input.application.requiresWoodTreatmentDisclosure,
    requiresStateOfDistillation: input.application.requiresStateOfDistillation,
    containsYellow5: input.application.containsYellow5,
    containsCochinealOrCarmine: input.application.containsCochinealOrCarmine,
    sulfitesPpm: input.application.sulfitesPpm,
    containsAspartame: input.application.containsAspartame,
    importCountryOfOrigin: input.application.importCountryOfOrigin,
    importBottlingDisposition: input.application.importBottlingDisposition,
    productionFacts: input.application.productionFacts,
  })
  if (!evaluation) return Object.values(input.coreChecks)

  return evaluation.rules.flatMap((rule) => {
    if (rule.status === 'does_not_apply') return []
    const coreId = coreRuleChecks[rule.rule.id]
    if (coreId) return [{ ...input.coreChecks[coreId], ruleId: rule.rule.id }]
    return [evaluatedRuleCard(rule, effectiveInput)]
  })
}
