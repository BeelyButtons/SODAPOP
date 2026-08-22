import { bestObservedLine, findAlcohol, normalizeWords, parseAlcohol, similarity } from './normalization'
import type { ApplicationData, CheckStatus, ReviewCheck } from './reviewSchema'
import { evaluateRuleSet, type RuleApplicability } from './ruleEngine'

type CoreCheckId = 'brand' | 'classType' | 'alcohol' | 'netContents' | 'warningText' | 'warningFormat'

type Input = {
  application: ApplicationData
  ocrText: string
  ocrConfidence: number
  ruleSetId: 'malt-beverage-domestic' | 'malt-beverage-imported'
  coreChecks: Record<CoreCheckId, ReviewCheck>
}

const coreRuleChecks: Record<string, CoreCheckId> = {
  'common.health-warning-wording': 'warningText',
  'common.health-warning-format': 'warningFormat',
  'malt.brand-name': 'brand',
}

function observedPhrase(phrase: string, text: string) {
  if (normalizeWords(text).includes(normalizeWords(phrase))) return phrase
  return bestObservedLine(phrase, text)
}

function phraseMatches(phrase: string, text: string) {
  const observed = observedPhrase(phrase, text)
  return normalizeWords(text).includes(normalizeWords(phrase)) || similarity(phrase, observed) >= 0.86
}

function hasFlavorTypeConflict(expected: string, text: string) {
  return /\bnatural\b/i.test(expected) && /\bartificial\s+(?:\w+\s+){0,2}flavor\b/i.test(text)
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
    observed,
    explanation,
    requirements,
    ...evidence,
  }
}

function missingContextCard(rule: RuleApplicability, detail?: string) {
  const missing = detail || (rule.missingFacts.length ? rule.missingFacts.join(', ') : 'required review evidence')
  return card(rule, 'needs_review', `Missing context: ${missing}`, `${rule.rule.missingContext} SODAPOP did not treat missing information as “does not apply.”`)
}

function textEvidenceCard(rule: RuleApplicability, text: string, confidence: number, phrases: string[], explanation: string) {
  const expected = phrases.map((phrase) => phrase.trim()).filter(Boolean)
  if (!expected.length) return missingContextCard(rule)
  const missing = expected.filter((phrase) => hasFlavorTypeConflict(phrase, text) || !phraseMatches(phrase, text))
  const observed = expected.map((phrase) => observedPhrase(phrase, text)).filter(Boolean).join(' · ') || 'Not found'
  if (!missing.length) return card(rule, 'pass', observed, explanation, expected)
  return card(
    rule,
    confidence < 68 ? 'needs_review' : 'mismatch',
    missing.length === expected.length ? 'Required statement not found' : observed,
    confidence < 68 ? `OCR could not reliably confirm: ${missing.join('; ')}.` : `Readable artwork omitted or conflicted with: ${missing.join('; ')}.`,
    expected,
  )
}

function labelSetCard(rule: RuleApplicability, application: ApplicationData, confidence: number) {
  if (application.labelSet === false) return card(rule, 'mismatch', 'Application indicates an incomplete label set.', 'Required label or container evidence is absent.')
  if (application.labelSet !== true || !application.labelDimensions || application.bottleMarkings === undefined) {
    return missingContextCard(rule, 'complete label set, dimensions, or container markings')
  }
  return card(rule, 'pass', 'Complete label and container context supplied.', 'The packet identifies submitted labels and any direct container markings.', undefined, {
    applicabilityExplanation: 'Every review requires all submitted label faces and applicable container markings.',
    applicationEvidence: `Dimensions: ${application.labelDimensions} · Container markings: ${application.bottleMarkings || 'None documented'}`,
    labelEvidence: `Artwork OCR confidence: ${Math.round(confidence)}%.`,
  })
}

function optionalInformationCard(rule: RuleApplicability, text: string, confidence: number) {
  const prohibitedSulfiteClaim = text.match(/\b(?:sulfite free|free of sulfites|contains no sulfites)\b/i)?.[0]
  if (prohibitedSulfiteClaim) return card(rule, 'mismatch', prohibitedSulfiteClaim, 'TTB does not permit this sulfite-absence wording.')
  const misleadingBeverageIdentity = text.match(/\b(?:bourbon[- ]flavored lager|chardonnay lager|lager with whiskey flavors?)\b/i)?.[0]
  if (misleadingBeverageIdentity) return card(rule, 'mismatch', misleadingBeverageIdentity, 'This wording misleadingly represents a malt beverage as containing or being a distilled-spirit or wine product.')
  return card(rule, confidence < 68 ? 'needs_review' : 'pass', confidence < 68 ? 'Optional text was not reliably inventoried.' : 'No prohibited optional claim was detected.', confidence < 68 ? 'Inspect optional statements and graphics.' : 'Conditional identity, alcohol, geographic, and additive claims are evaluated by dedicated rules.')
}

function classTypeCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const actual = parseAlcohol(application.alcoholContent).abv
  if (actual === null) return missingContextCard(rule, 'actual alcohol content')
  if (application.maltSpecialtyProduct) {
    return textEvidenceCard(rule, text, confidence, [application.fancifulName ?? '', application.formulaCompositionStatement ?? ''], 'The fanciful name and formula-consistent specialty designation were located.')
  }
  const expected = application.classType
  const found = phraseMatches(expected, text)
  const normalized = normalizeWords(expected)
  if (actual < 0.5 && !/^(?:malt beverage|cereal beverage|near beer)$/.test(normalized)) {
    return card(rule, 'mismatch', expected, 'A malt beverage below 0.5% alcohol must use “malt beverage,” “cereal beverage,” or “near beer,” rather than an ordinary alcoholic-beverage class.')
  }
  if (/^ipa$/.test(normalized)) return card(rule, 'mismatch', expected, '“IPA” alone is not a recognized class/type designation; the label must also state ale, beer, or India Pale Ale.')
  return card(
    rule,
    found ? 'pass' : confidence < 68 ? 'needs_review' : 'mismatch',
    found ? observedPhrase(expected, text) : 'Class/type not reliably located',
    found ? 'The recognized class/type matches the application context.' : confidence < 68 ? 'Inspect the class/type because OCR confidence is limited.' : `Readable artwork did not contain ${expected}.`,
  )
}

function netContentsCard(rule: RuleApplicability, application: ApplicationData, coreCheck: ReviewCheck) {
  const combined = `${application.netContents} ${application.bottleMarkings ?? ''}`
  const hasUsUnits = /\b(?:fl\.?\s*oz\.?|fluid ounces?|pints?|quarts?|gallons?)\b/i.test(combined)
  if (!hasUsUnits) return card(rule, 'mismatch', application.netContents, 'Malt-beverage net contents require standard U.S. units; metric units may be additional but cannot replace them.')
  return { ...coreCheck, id: rule.rule.id, ruleId: rule.rule.id, label: rule.rule.title }
}

function nameAddressCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const name = application.permitName || application.applicantName
  const address = application.permitAddress || application.applicantAddress
  if (!name || !address) return missingContextCard(rule, 'Brewer’s Notice/basic-permit name or address')
  const disposition = application.importBottlingDisposition ?? ''
  const furtherProducedAfterImport = application.source === 'imported'
    && application.maltPostImportBottling === true
    && !/without[^.]{0,60}(?:blend|further production|processing)/i.test(disposition)
    && /blend|produced|production|processed/i.test(disposition)
  const domesticPhrases = ['BREWED AND BOTTLED BY', 'BREWED AND CANNED BY', 'BREWED AND PACKED BY', 'BOTTLED BY', 'CANNED BY', 'PACKED BY']
  const phrases = application.source === 'imported' && !furtherProducedAfterImport
    ? ['IMPORTED BY', 'SOLE AGENT', 'SOLE U.S. AGENT', 'IMPORTED AND BOTTLED', 'IMPORTED AND CANNED', 'IMPORTED AND PACKED']
    : domesticPhrases
  const operation = phrases.find((phrase) => phraseMatches(phrase, text))
  const missing = [name, address].filter((value) => !phraseMatches(value, text))
  if (!operation) missing.unshift(`authorized ${application.source} operation phrase`)
  if (!missing.length) return card(rule, 'pass', `${operation} ${name}, ${address}`, 'The responsible-party phrase, permitted name, and city/State match the packet.', [operation!, name, address])
  return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', 'Required responsible-party statement was not fully matched', `${confidence < 68 ? 'OCR could not resolve' : 'Readable artwork omitted or conflicted with'}: ${missing.join('; ')}.`)
}

function countryOriginCard(rule: RuleApplicability, application: ApplicationData, text: string) {
  const expected = application.importCountryOfOrigin
  if (!expected) return missingContextCard(rule, 'country of origin')
  const detected = text.match(/\b(?:product|produce)\s+of\s+([a-z][a-z ]{2,35})/i)?.[1]?.split(/\s{2,}|\n|imported|contains/i)[0]?.trim()
  if (!detected) return card(rule, 'needs_review', 'Country-of-origin statement was not readable in OCR.', 'Inspect the origin area; OCR cannot prove whether the statement is absent or obscured.', [`PRODUCT OF ${expected}`])
  const passes = normalizeWords(detected).startsWith(normalizeWords(expected))
  return card(rule, passes ? 'pass' : 'mismatch', `PRODUCT OF ${detected}`, passes ? 'The country-of-origin statement matches the import packet.' : `The detected country conflicts with ${expected}.`, [`PRODUCT OF ${expected}`])
}

function importDispositionCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const disposition = application.importBottlingDisposition
  if (!disposition) return missingContextCard(rule, 'post-import bottling or production disposition')
  const explicitlyNoFurtherProduction = /without[^.]{0,60}(?:blend|further production|processing)/i.test(disposition)
  const furtherProduced = !explicitlyNoFurtherProduction && /blend|produced|production|processed/i.test(disposition)
  const phrases = furtherProduced
    ? ['BREWED AND BOTTLED BY', 'BREWED AND CANNED BY', 'BREWED AND PACKED BY', 'BOTTLED BY', 'CANNED BY', 'PACKED BY']
    : ['IMPORTED AND BOTTLED', 'IMPORTED AND CANNED', 'IMPORTED AND PACKED', 'IMPORTED BY']
  const detected = phrases.find((phrase) => phraseMatches(phrase, text))
  const prohibitedImportedBy = furtherProduced && phraseMatches('IMPORTED BY', text)
  if (detected && !prohibitedImportedBy) return card(rule, 'pass', detected, furtherProduced ? 'The label uses domestic responsible-party wording after U.S. production activity.' : 'The label identifies the importer and U.S. bottling/packing disposition.')
  return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', detected ?? 'Required post-import disposition wording not found', prohibitedImportedBy ? 'An “imported by” statement may not remain after blending or other U.S. production activity.' : `The stated disposition requires one of: ${phrases.join('; ')}.`)
}

function alcoholContentCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const actual = parseAlcohol(application.alcoholContent).abv
  if (actual === null) return missingContextCard(rule, 'actual alcohol content')
  const prohibitedRange = text.match(/\b(?:at least|not more than|maximum|minimum)\b[^\n%]{0,30}\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%\s*(?:to|-)\s*\d+(?:\.\d+)?\s*%/i)?.[0]
  if (prohibitedRange) return card(rule, 'mismatch', prohibitedRange, 'Malt-beverage alcohol content may not be expressed as a range, maximum, or minimum value.')
  const observed = findAlcohol(text)
  if (!observed) return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', 'Alcohol statement not found', application.maltAlcoholFromAddedIngredients ? 'Alcohol by volume is mandatory because covered added ingredients contribute alcohol.' : 'The application or artwork indicates an alcohol statement, but OCR did not locate one.')
  if (/\bABV\b/i.test(observed)) return card(rule, 'mismatch', observed, '“ABV” is not an authorized abbreviation in a malt-beverage alcohol-content statement.')
  const labeled = parseAlcohol(observed).abv
  if (labeled === null) return card(rule, 'needs_review', observed, 'OCR did not yield a reliable numerical alcohol value.')
  const crossesThreshold = (actual < 0.5) !== (labeled < 0.5)
  const passes = Math.abs(actual - labeled) <= 0.3 && !crossesThreshold
  return card(rule, passes ? 'pass' : 'mismatch', observed, passes ? 'The statement uses an authorized form and is within the ±0.3 percentage-point tolerance.' : 'The statement is outside the ±0.3 tolerance or crosses the 0.5% class boundary.')
}

function specialtyCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const expected = application.formulaCompositionStatement ?? ''
  const contradictsFlavorType = hasFlavorTypeConflict(expected, text)
  if (contradictsFlavorType) {
    return card(rule, 'mismatch', bestObservedLine(expected, text), 'The readable specialty statement changes an approved natural-flavor representation to artificial flavoring.')
  }
  return textEvidenceCard(rule, text, confidence, [application.fancifulName ?? '', application.formulaCompositionStatement ?? ''], 'The fanciful name and formula-consistent statement of composition appear together.')
}

function alcoholClaimCard(rule: RuleApplicability, application: ApplicationData, text: string) {
  const actual = parseAlcohol(application.alcoholContent).abv
  if (actual === null) return missingContextCard(rule, 'actual alcohol analysis')
  const claim = text.match(/\b(?:low alcohol|reduced alcohol|non[- ]alcoholic|alcohol free)\b/i)?.[0]
  if (!claim) return card(rule, 'mismatch', 'Activated alcohol-characterization claim was not found', 'The packet indicates a claim, but readable artwork does not show which claim is being made.')
  if (/low alcohol|reduced alcohol/i.test(claim)) return card(rule, actual < 2.5 ? 'pass' : 'mismatch', claim, actual < 2.5 ? 'The actual alcohol content is below 2.5%.' : 'Low/reduced alcohol requires actual alcohol below 2.5%.')
  if (/non[- ]alcoholic/i.test(claim)) {
    const adjacentStatement = /non[- ]alcoholic[^\n]{0,100}contains less than (?:0?\.5|one-half)\s*(?:percent|%)\s+alcohol by volume/i.test(text.replace(/\n/g, ' '))
    return card(rule, actual < 0.5 && adjacentStatement ? 'pass' : 'mismatch', claim, actual < 0.5 && adjacentStatement ? 'The product is below 0.5% and the required adjacent statement appears.' : '“Non-alcoholic” requires actual alcohol below 0.5% and an immediately adjacent “contains less than 0.5 percent alcohol by volume” statement.')
  }
  return card(rule, actual === 0 ? 'pass' : 'mismatch', claim, actual === 0 ? 'The supporting analysis documents no alcohol.' : '“Alcohol free” is permitted only when the product contains no alcohol.')
}

function geographicCard(rule: RuleApplicability, application: ApplicationData, text: string) {
  const designation = application.classType
  const production = normalizeWords(application.productionFacts ?? '')
  if (!designation || !production) return missingContextCard(rule, 'designation or production location')
  const labelDesignation = bestObservedLine(designation, text) || designation
  const foreignSignificant = /\b(?:belgian|german|irish|scotch|vienna|munich|dortmunder)\b/i.test(labelDesignation)
  const domesticProduction = /\b(?:united states|usa|american|colorado|oregon|california|new york|maine)\b/.test(production)
  const qualified = /\b(?:style|type|american|product of (?:the )?u\.?s\.?a\.?)\b/i.test(labelDesignation)
  const passes = !foreignSignificant || !domesticProduction || qualified
  return card(rule, passes ? 'pass' : 'mismatch', labelDesignation, passes ? 'The geographic designation agrees with the production facts or is properly qualified.' : 'A geographically significant foreign term used on a U.S.-produced malt beverage requires “style,” “type,” “American,” or equivalent qualification.')
}

function sulfitesCard(rule: RuleApplicability, text: string, confidence: number) {
  const detected = text.match(/\bcontains\s+(?:(?:only\s+)?naturally\s+occurring\s+)?sul(?:f|ph)ites\b|\bcontains\s+(?:a\s+)?sulfiting\s+agents?\b/i)?.[0]
  if (detected) return card(rule, 'pass', detected, 'An authorized sulfite declaration was located.')
  return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', 'Authorized sulfite declaration not found', confidence < 68 ? 'OCR could not reliably resolve the declaration.' : 'Readable artwork omitted the required sulfite declaration.')
}

function mandatoryLanguageLocationCard(rule: RuleApplicability, application: ApplicationData, coreChecks: Input['coreChecks']) {
  if (application.labelSet === false) return card(rule, 'mismatch', 'Incomplete label evidence', 'The complete label and container surfaces are required to assess language and permitted placement.')
  if (application.labelSet !== true || application.bottleMarkings === undefined) return missingContextCard(rule, 'complete label/layout and container-marking evidence')
  const unresolved = [coreChecks.brand, coreChecks.classType, coreChecks.netContents].filter((check) => check.status !== 'pass').map((check) => check.label)
  if (unresolved.length) return card(rule, 'needs_review', `Unresolved mandatory evidence: ${unresolved.join(', ')}`, 'Inspect whether required English information appears on an acceptable label or authorized container surface.')
  return card(rule, 'pass', 'Mandatory information appears in English on the submitted label face.', 'The packet identifies an acceptable label surface and any authorized direct container markings.', undefined, { applicationEvidence: `Container markings: ${application.bottleMarkings || 'None documented'}` })
}

function evaluatedRuleCard(rule: RuleApplicability, input: Input): ReviewCheck {
  if (rule.status === 'missing_context') return missingContextCard(rule)
  const { application, ocrText, ocrConfidence, coreChecks } = input
  switch (rule.rule.id) {
    case 'common.label-set-completeness': return labelSetCard(rule, application, ocrConfidence)
    case 'common.optional-information': return optionalInformationCard(rule, ocrText, ocrConfidence)
    case 'common.formula-labeling-instructions': return textEvidenceCard(rule, ocrText, ocrConfidence, application.formulaLabelingInstructions?.split('|') ?? [], 'Every formula-directed labeling statement was located.')
    case 'common.exemption-eligibility': return card(rule, 'mismatch', 'Malt beverage', 'Certificates of exemption from label approval are unavailable for malt beverages.')
    case 'common.exemption-state-limitation': return textEvidenceCard(rule, ocrText, ocrConfidence, application.destinationState ? [`FOR SALE IN ${application.destinationState} ONLY`] : [], 'The State limitation matches the application.')
    case 'malt.class-type-designation': return classTypeCard(rule, application, ocrText, ocrConfidence)
    case 'malt.net-contents': return netContentsCard(rule, application, coreChecks.netContents)
    case 'malt.name-address': return nameAddressCard(rule, application, ocrText, ocrConfidence)
    case 'malt.alcohol-content': return alcoholContentCard(rule, application, ocrText, ocrConfidence)
    case 'malt.specialty-composition': return specialtyCard(rule, application, ocrText, ocrConfidence)
    case 'malt.alcohol-characterization-claims': return alcoholClaimCard(rule, application, ocrText)
    case 'malt.country-of-origin': return countryOriginCard(rule, application, ocrText)
    case 'malt.import-bottling-disposition': return importDispositionCard(rule, application, ocrText, ocrConfidence)
    case 'malt.geographic-designation': return geographicCard(rule, application, ocrText)
    case 'malt.yellow-5': return textEvidenceCard(rule, ocrText, ocrConfidence, ['CONTAINS FD&C YELLOW NO. 5'], 'The specific Yellow No. 5 declaration was located.')
    case 'malt.cochineal-carmine': {
      const evidence = `${application.formulaLabelingInstructions ?? ''} ${application.productionFacts ?? ''}`
      const declaration = /cochineal/i.test(evidence) ? 'CONTAINS COCHINEAL EXTRACT' : /carmine/i.test(evidence) ? 'CONTAINS CARMINE' : undefined
      return declaration ? textEvidenceCard(rule, ocrText, ocrConfidence, [declaration], 'The specific color-additive declaration was located.') : missingContextCard(rule, 'specific color additive')
    }
    case 'malt.sulfites': return sulfitesCard(rule, ocrText, ocrConfidence)
    case 'malt.aspartame': return textEvidenceCard(rule, ocrText, ocrConfidence, ['PHENYLKETONURICS: CONTAINS PHENYLALANINE'], 'The prescribed uppercase aspartame declaration was located.')
    case 'malt.mandatory-language-location': return mandatoryLanguageLocationCard(rule, application, coreChecks)
    default: return card(rule, 'needs_review', 'No specialized evaluator is available.', 'Review the cited requirement and evidence directly.')
  }
}

export function maltBeverageChecks(input: Input) {
  const selectedSource = input.ruleSetId === 'malt-beverage-imported' ? 'imported' : 'domestic'
  const application = { ...input.application, source: selectedSource } as ApplicationData
  const labelAlcoholStatementPresent = Boolean(findAlcohol(input.ocrText) || /\bABV\b|\balcohol\s+(?:content|by volume)\b/i.test(input.ocrText))
  const evaluation = evaluateRuleSet(input.ruleSetId, {
    productType: 'malt_beverage',
    source: selectedSource,
    applicationType: application.applicationType,
    destinationState: application.destinationState,
    alcoholContent: parseAlcohol(application.alcoholContent).abv ?? undefined,
    containerVolumeMl: application.containerVolumeMl,
    brandName: application.brandName,
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
    labelAlcoholStatementPresent,
    containsYellow5: application.containsYellow5,
    containsCochinealOrCarmine: application.containsCochinealOrCarmine,
    sulfitesPpm: application.sulfitesPpm,
    containsAspartame: application.containsAspartame,
    maltAlcoholFromAddedIngredients: application.maltAlcoholFromAddedIngredients,
    maltAlcoholCharacterizationClaim: application.maltAlcoholCharacterizationClaim,
    maltGeographicClaim: application.maltGeographicClaim,
    maltSpecialtyProduct: application.maltSpecialtyProduct,
    maltPostImportBottling: application.maltPostImportBottling,
    importCountryOfOrigin: application.importCountryOfOrigin,
    importBottlingDisposition: application.importBottlingDisposition,
    productionFacts: application.productionFacts,
  })
  if (!evaluation) return Object.values(input.coreChecks)
  const effectiveInput = { ...input, application }
  return evaluation.rules.flatMap((rule) => {
    if (rule.status === 'does_not_apply') return []
    const coreId = coreRuleChecks[rule.rule.id]
    if (coreId) return [{ ...input.coreChecks[coreId], ruleId: rule.rule.id, id: rule.rule.id }]
    return [evaluatedRuleCard(rule, effectiveInput)]
  })
}
