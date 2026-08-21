import { bestObservedLine, normalizeWords, similarity } from './normalization'
import type { ApplicationData, CheckStatus, ReviewCheck } from './reviewSchema'
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
    `Readable OCR did not contain the required packet-matched statement${missing.length > 1 ? 's' : ''}: ${missing.join('; ')}.`,
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
      'The responsibility phrase, permit name, and city/State match the review packet. Formatting remains visible for staff confirmation.',
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
  if (fieldChecks.every((check) => check.status === 'pass' && check.highlight)) {
    return card(
      rule,
      'pass',
      'Brand name, class/type, and alcohol content were located on this submitted label face.',
      'All three required statements were located together on the same artwork face and can be inspected through their OCR highlights.',
    )
  }
  if (fieldChecks.some((check) => check.status === 'mismatch')) {
    return card(
      rule,
      'mismatch',
      'One or more required statements were not matched on this label face.',
      'SODAPOP could not establish the required shared field of vision because a mandatory statement is missing or conflicting.',
    )
  }
  return card(
    rule,
    'needs_review',
    'The OCR evidence does not establish all three locations.',
    'Confirm the brand name, class/type, and alcohol content can all be viewed without turning the container.',
  )
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
    return card(rule, 'pass', `PRODUCT OF ${detected}`, 'The country-of-origin statement matches the imported-product packet.', [`PRODUCT OF ${expected}`])
  }
  return card(
    rule,
    'mismatch',
    `PRODUCT OF ${detected}`,
    `The detected country conflicts with the packet country, ${expected}.`,
    [`PRODUCT OF ${expected}`],
  )
}

function optionalInformationCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const claimPatterns = [
    /\bsmall batch\b/i,
    /\b(?:aged|old)\s+(?:at least\s+)?\d+\s+(?:year|month)/i,
    /\b(?:organic|natural|handmade|estate|reserve)\b/i,
  ]
  const claims = claimPatterns.flatMap((pattern) => text.match(pattern)?.[0] ?? [])
  if (!claims.length && confidence >= 68) {
    return card(rule, 'pass', 'No material optional claim was detected.', 'No unsupported optional textual claim was identified in the readable OCR evidence.')
  }
  const facts = normalizeWords([
    application.productionFacts,
    application.formulaCompositionStatement,
    application.formulaLabelingInstructions,
    application.classType,
  ].filter(Boolean).join(' '))
  const unsupported = claims.filter((claim) => {
    const normalizedClaim = normalizeWords(claim)
    if (/aged|old/.test(normalizedClaim) && /aged|youngest/.test(facts)) return false
    return !facts.includes(normalizedClaim)
  })
  if (!unsupported.length && claims.length) {
    return card(rule, 'pass', claims.join(' · '), 'Detected optional claims have corresponding production support in the review packet.')
  }
  return card(
    rule,
    'needs_review',
    claims.length ? claims.join(' · ') : 'OCR was not sufficiently readable to inventory claims.',
    unsupported.length
      ? `Supporting evidence was not found for: ${unsupported.join('; ')}. Confirm truthfulness and whether more documentation is required.`
      : 'Inspect graphics and any text OCR could not read; no automatic failure was inferred from poor image quality.',
  )
}

function ageCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const facts = application.productionFacts ?? ''
  const age = facts.match(/(?:youngest(?: applicable)? spirit (?:is |was )?aged|youngest age:)\s*(\d+)\s*(years?|months?)/i)
  if (!age) return missingContextCard(rule)
  const amount = age[1]
  const unit = age[2]
  const accepted = [
    `AGED ${amount} ${unit}`,
    `${amount} ${unit} OLD`,
    `AGED AT LEAST ${amount} ${unit}`,
    `AGED A MINIMUM OF ${amount} ${unit}`,
  ]
  const matched = accepted.find((phrase) => phraseMatches(phrase, text))
  if (matched) return {
    ...card(rule, 'pass', matched, 'The age statement agrees with the youngest applicable spirit documented in the packet.', accepted),
    requirementsLabel: 'Accepted forms — one is required',
  }
  return {
    ...card(
    rule,
    confidence < 68 ? 'needs_review' : 'mismatch',
    'Supporting age statement not matched',
    confidence < 68
      ? 'OCR could not reliably resolve the age statement. Confirm it against the youngest-spirit facts.'
      : `No acceptable statement reflecting ${amount} ${unit} was detected.`,
    accepted,
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
      return application.labelSet === true
        ? card(rule, 'pass', application.labelDimensions || 'Complete label set supplied', 'The review packet identifies the submitted label set and provides readable artwork evidence.')
        : application.labelSet === false
          ? card(rule, 'mismatch', 'Application indicates an incomplete label set.', 'Required label or container evidence is absent from the packet.')
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
        ? card(rule, 'pass', application.bottleDesignEvidence, 'The requested bottle views and design evidence are documented in the packet.')
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
      return ageCard(rule, application, ocrText, ocrConfidence)
    case 'spirits.wood-treatment':
      return productionDisclosure(rule, application, ocrText, ocrConfidence, 'Wood treatment disclosure', 'COLORED AND FLAVORED WITH WOOD')
    case 'spirits.state-of-distillation':
      return productionDisclosure(rule, application, ocrText, ocrConfidence, 'State of distillation')
    case 'spirits.yellow-5':
      return textEvidenceCard(rule, ocrText, ocrConfidence, ['CONTAINS FD&C YELLOW NO. 5'], 'The specific color-additive declaration was located.')
    case 'spirits.cochineal-carmine': {
      const declaration = /cochineal/i.test(application.formulaLabelingInstructions ?? '') ? 'CONTAINS COCHINEAL EXTRACT' : 'CONTAINS CARMINE'
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
