import { bestObservedLine, findAlcohol, normalizeWords, parseAlcohol, similarity } from './normalization'
import type { ApplicationData, CheckStatus, HighlightRegion, ReviewCheck } from './reviewSchema'
import { evaluateRuleSet, type RuleApplicability } from './ruleEngine'

type CoreCheckId = 'brand' | 'classType' | 'alcohol' | 'netContents' | 'warningText' | 'warningFormat'

type Input = {
  application: ApplicationData
  ocrText: string
  ocrConfidence: number
  ruleSetId: 'wine-7plus-domestic' | 'wine-7plus-imported' | 'wine-under-7-ttb-routing'
  coreChecks: Record<CoreCheckId, ReviewCheck>
}

const coreRuleChecks: Record<string, CoreCheckId> = {
  'common.health-warning-wording': 'warningText',
  'common.health-warning-format': 'warningFormat',
  'wine.brand-name': 'brand',
  'wine.class-type-designation': 'classType',
  'wine.net-contents': 'netContents',
  'wine.under-seven-brand-name': 'brand',
  'wine.under-seven-net-contents': 'netContents',
  'wine.under-seven-kind-designation': 'classType',
}

function observedPhrase(phrase: string, text: string) {
  if (normalizeWords(text).includes(normalizeWords(phrase))) return phrase
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
    observed,
    explanation,
    requirements,
    ...evidence,
  }
}

function missingContextCard(rule: RuleApplicability, detail?: string) {
  const missing = detail || (rule.missingFacts.length ? rule.missingFacts.join(', ') : 'required review evidence')
  return card(
    rule,
    'needs_review',
    `Missing context: ${missing}`,
    `${rule.rule.missingContext} LabelEvidence did not treat missing information as “does not apply.”`,
  )
}

function textEvidenceCard(
  rule: RuleApplicability,
  text: string,
  confidence: number,
  phrases: string[],
  explanation: string,
) {
  const expected = phrases.map((phrase) => phrase.trim()).filter(Boolean)
  if (!expected.length) return missingContextCard(rule)
  const missing = expected.filter((phrase) => !phraseMatches(phrase, text))
  const observed = expected.map((phrase) => observedPhrase(phrase, text)).filter(Boolean).join(' · ') || 'Not found'
  if (!missing.length) return card(rule, 'pass', observed, explanation, expected)
  return card(
    rule,
    confidence < 68 ? 'needs_review' : 'mismatch',
    missing.length === expected.length ? 'Required statement not found' : observed,
    confidence < 68
      ? `OCR could not reliably confirm: ${missing.join('; ')}. Inspect the artwork before deciding.`
      : `Readable OCR did not contain the required statement${missing.length > 1 ? 's' : ''}: ${missing.join('; ')}.`,
    expected,
  )
}

function combinedHighlight(checks: ReviewCheck[]): HighlightRegion | undefined {
  const regions = checks.flatMap((check) => check.highlight ? [check.highlight] : [])
  const first = regions[0]
  if (!first) return undefined
  return {
    imageWidth: first.imageWidth,
    imageHeight: first.imageHeight,
    boxes: regions
      .filter((region) => region.imageWidth === first.imageWidth && region.imageHeight === first.imageHeight)
      .flatMap((region) => region.boxes),
  }
}

function labelSetCard(rule: RuleApplicability, application: ApplicationData, confidence: number) {
  if (application.labelSet === false) {
    return card(rule, 'mismatch', 'Application indicates an incomplete label set.', 'Required label or container evidence is absent.')
  }
  if (application.labelSet !== true || !application.labelDimensions || application.bottleMarkings === undefined) {
    return missingContextCard(rule, 'complete label set, dimensions, or container markings')
  }
  return card(
    rule,
    'pass',
    'Complete label-set, dimension, and container-marking context supplied.',
    'The submitted evidence identifies the label set and any container-applied information.',
    undefined,
    {
      applicabilityExplanation: 'Every review requires all submitted label faces and applicable container markings.',
      applicationEvidence: `Dimensions: ${application.labelDimensions} · Container markings: ${application.bottleMarkings || 'None documented'}`,
      labelEvidence: `Artwork OCR confidence: ${Math.round(confidence)}%.`,
    },
  )
}

function optionalInformationCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const prohibitedSulfiteClaim = text.match(/\b(?:sulfite free|free of sulfites|contains no sulfites)\b/i)?.[0]
  if (prohibitedSulfiteClaim) {
    return card(rule, 'mismatch', prohibitedSulfiteClaim, 'TTB does not permit this sulfite-absence wording. Use an authorized statement supported by TTB laboratory evidence.')
  }
  const qualifiedSulfiteClaim = text.match(/\b(?:contains less than 10 ppm (?:sulfites|sulfur dioxide)|no (?:detectable )?(?:sulfites|sulfur dioxide) detected)\b/i)?.[0]
  if (qualifiedSulfiteClaim) {
    if (application.sulfitesPpm === undefined) return missingContextCard(rule, 'TTB sulfite-analysis result')
    return card(rule, application.sulfitesPpm < 10 ? 'pass' : 'mismatch', qualifiedSulfiteClaim, application.sulfitesPpm < 10 ? 'The qualified optional claim is supported by the supplied sub-10-ppm result.' : 'The optional sulfite claim conflicts with the supplied analysis result.')
  }
  const claims = [
    text.match(/\bestate bottled\b/i)?.[0],
    text.match(/\b(?:organic|reserve|old vine|natural)\b/i)?.[0],
  ].filter((value): value is string => Boolean(value))
  if (!claims.length && confidence >= 68) {
    return card(rule, 'pass', 'No unsupported material optional claim was detected.', 'Specific varietal, vintage, appellation, and estate claims are evaluated by their dedicated rules.')
  }
  const facts = normalizeWords(application.productionFacts ?? '')
  const unsupported = claims.filter((claim) => !facts.includes(normalizeWords(claim)) && !/estate bottled/i.test(claim))
  if (!unsupported.length && claims.length) {
    return card(rule, 'pass', claims.join(' · '), 'Detected optional claims have corresponding application support or a dedicated conditional rule.')
  }
  return card(
    rule,
    'needs_review',
    claims.join(' · ') || 'Optional text was not reliably inventoried.',
    unsupported.length ? `Confirm support for: ${unsupported.join('; ')}.` : 'Inspect optional text and graphics that OCR could not resolve.',
  )
}

function wineAlcoholCard(rule: RuleApplicability, application: ApplicationData, text: string, requireNumeric: boolean) {
  const actual = parseAlcohol(application.alcoholContent).abv
  if (actual === null) return missingContextCard(rule, 'actual/application alcohol content')
  const range = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*%?[^\n]{0,30}(?:alcohol|alc\.?)/i)
  const observedText = range?.[0] || findAlcohol(text)
  if (/\bABV\b/i.test(observedText)) {
    return card(rule, 'mismatch', observedText, '“ABV” is not an authorized abbreviation for the wine alcohol-content statement.')
  }
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    const maximumWidth = actual > 14 ? 2 : 3
    const crossesTaxClass = low <= 14 && high > 14
    const passes = low <= actual && actual <= high && high - low <= maximumWidth && !crossesTaxClass
    return card(
      rule,
      passes ? 'pass' : 'mismatch',
      observedText,
      passes
        ? 'The stated range contains the application ABV, stays within the permitted width, and does not cross the 14% taxable-grade boundary.'
        : 'The alcohol range misses the application ABV, is too wide, or crosses the 14% taxable-grade boundary.',
    )
  }
  const labeled = parseAlcohol(observedText).abv
  if (labeled === null) {
    if (!requireNumeric && actual <= 14 && /\b(?:table|light)\s+wine\b/i.test(text)) {
      return card(rule, 'pass', text.match(/\b(?:table|light)\s+wine\b/i)?.[0] ?? 'TABLE WINE', 'For wine from 7% through 14%, the authorized table/light-wine designation may replace a numerical statement.')
    }
    return card(rule, 'needs_review', 'Numerical alcohol statement not reliably detected.', requireNumeric ? 'A numerical alcohol statement is required for this branch; confirm whether OCR missed it.' : 'Confirm a numerical statement or the authorized table/light-wine substitute.')
  }
  const tolerance = actual > 14 ? 1 : 1.5
  const crossesTaxClass = (actual > 14) !== (labeled > 14)
  const passes = Math.abs(actual - labeled) <= tolerance && !crossesTaxClass
  return card(
    rule,
    passes ? 'pass' : 'mismatch',
    observedText,
    passes
      ? `The labeled value is within the applicable ±${tolerance} percentage-point tolerance and the correct taxable grade.`
      : `The labeled value is outside the applicable tolerance or indicates the wrong side of the 14% taxable-grade boundary.`,
  )
}

function nameAddressCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const name = application.permitName || application.applicantName
  const address = application.permitAddress || application.applicantAddress
  if (!name || !address) return missingContextCard(rule, 'permit name or address')
  const phrases = application.source === 'imported'
    ? ['IMPORTED BY', 'SOLE U.S. AGENT', 'IMPORTED AND BOTTLED BY']
    : ['BOTTLED BY', 'PACKED BY']
  const operation = phrases.find((phrase) => phraseMatches(phrase, text))
  const missing = [name, address].filter((value) => !phraseMatches(value, text))
  if (!operation) missing.unshift(`authorized ${application.source} operation phrase`)
  if (!missing.length) {
    return card(rule, 'pass', `${operation} ${name}, ${address}`, 'The operation phrase, permit name, and address match the application evidence.', [operation!, name, address])
  }
  return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', 'Required responsible-party statement was not fully matched', `${confidence < 68 ? 'OCR could not resolve' : 'Readable OCR omitted or conflicted with'}: ${missing.join('; ')}.`)
}

function brandLabelPlacementCard(rule: RuleApplicability, application: ApplicationData, coreChecks: Input['coreChecks'], text: string) {
  const required = [coreChecks.brand, coreChecks.classType]
  const conditionalPhrases = [application.wineAppellation, application.wineVintage].filter((value): value is string => Boolean(value))
  const missing = required.filter((check) => check.status !== 'pass').map((check) => check.label)
  missing.push(...conditionalPhrases.filter((phrase) => !phraseMatches(phrase, text)))
  const singleBrandFace = /single|brand label/i.test(application.labelDimensions ?? '')
  const highlight = combinedHighlight(required)
  if (!missing.length && singleBrandFace) {
    return { ...card(rule, 'pass', 'Required brand-label statements were located on the submitted brand-label face.', 'Brand, class/type, and triggered appellation/vintage evidence were found together.'), highlight }
  }
  return {
    ...card(rule, missing.length ? 'mismatch' : 'needs_review', missing.length ? `Problem with: ${missing.join(', ')}` : 'Label-role evidence is unresolved.', missing.length ? 'One or more required brand-label statements was not found.' : 'The statements were found, but the packet does not identify which submitted face is the brand label.'),
    highlight,
  }
}

function countryOriginCard(rule: RuleApplicability, application: ApplicationData, text: string) {
  const expected = application.importCountryOfOrigin
  if (!expected) return missingContextCard(rule, 'country of origin')
  const detected = text.match(/\b(?:product|produce)\s+of\s+([a-z][a-z ]{2,35})/i)?.[1]?.split(/\s{2,}|\n|imported|contains/i)[0]?.trim()
  if (!detected) return card(rule, 'needs_review', 'Country-of-origin statement was not readable in OCR.', 'Inspect the origin area; ordinary OCR cannot prove whether the statement is absent or obscured.', [`PRODUCT OF ${expected}`])
  const passes = normalizeWords(detected).startsWith(normalizeWords(expected))
  return card(rule, passes ? 'pass' : 'mismatch', `PRODUCT OF ${detected}`, passes ? 'The origin statement matches the imported-wine context.' : `The detected country conflicts with ${expected}.`, [`PRODUCT OF ${expected}`])
}

function appellationCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const appellation = application.wineAppellation
  const kind = application.wineAppellationType
  const percentage = application.wineAppellationPercentage
  if (!appellation || !kind || percentage === undefined) return missingContextCard(rule, 'appellation, appellation type, or origin percentage')
  if (!phraseMatches(appellation, text)) return textEvidenceCard(rule, text, confidence, [appellation], 'The appellation appears on the label.')
  const threshold = kind === 'ava' || kind === 'foreign_viticultural_area' ? 85 : 75
  if (application.source === 'domestic' && application.wineFinishedInRequiredArea === undefined) return missingContextCard(rule, 'required finishing-location evidence')
  if (application.source === 'imported' && application.wineForeignLawCompliant === undefined) return missingContextCard(rule, 'foreign-law conformity evidence')
  const domesticSupport = application.source !== 'domestic' || application.wineFinishedInRequiredArea === true
  const foreignSupport = application.source !== 'imported' || application.wineForeignLawCompliant === true
  const passes = percentage >= threshold && domesticSupport && foreignSupport
  return card(
    rule,
    passes ? 'pass' : 'mismatch',
    appellation,
    passes
      ? `The appellation is supported by ${percentage}% origin evidence and the applicable production context.`
      : `The appellation requires at least ${threshold}% origin support and applicable domestic-finishing or foreign-law evidence.`,
    [`At least ${threshold}% from ${appellation}`, 'Required production-location or foreign-law support'],
    {
      applicabilityExplanation: 'A varietal, vintage, estate, or other appellation-triggering representation is present.',
      applicationEvidence: `${percentage}% from ${appellation} · Type: ${kind.replaceAll('_', ' ')} · Finished-area support: ${application.wineFinishedInRequiredArea ?? 'Not supplied'} · Foreign-law support: ${application.wineForeignLawCompliant ?? 'Not supplied'}`,
      labelEvidence: observedPhrase(appellation, text) || 'Not found',
    },
  )
}

function varietalCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const varietals = application.wineVarietals
  if (!varietals?.length || !application.wineAppellation) return missingContextCard(rule, 'varietal percentages or appellation')
  const missingNames = varietals.filter(({ name }) => !phraseMatches(name, text)).map(({ name }) => name)
  if (missingNames.length) return textEvidenceCard(rule, text, confidence, varietals.map(({ name }) => name), 'The varietal names appear on the label.')
  if (varietals.length === 1) {
    const passes = varietals[0].percentage >= 75
    return card(rule, passes ? 'pass' : 'mismatch', varietals[0].name, passes ? 'The single varietal has at least 75% support and is accompanied by an appellation.' : `Only ${varietals[0].percentage}% of the wine is documented from the named varietal; the ordinary minimum is 75%.`)
  }
  const total = varietals.reduce((sum, varietal) => sum + varietal.percentage, 0)
  const missingPercentages = varietals.filter(({ name, percentage }) => !phraseMatches(`${percentage}% ${name}`, text))
  const passes = Math.abs(total - 100) < 0.01 && !missingPercentages.length
  return card(rule, passes ? 'pass' : 'mismatch', varietals.map(({ name, percentage }) => `${percentage}% ${name}`).join(' · '), passes ? 'All varieties and percentages are stated and total 100%.' : 'Multiple-variety labeling must state every percentage and the documented varieties must total 100%.')
}

function vintageCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const vintage = application.wineVintage
  const percentage = application.wineVintagePercentage
  const kind = application.wineAppellationType
  if (!vintage || percentage === undefined || !kind || !application.wineAppellation) return missingContextCard(rule, 'vintage, vintage percentage, appellation, or appellation type')
  if (!phraseMatches(vintage, text)) return textEvidenceCard(rule, text, confidence, [vintage], 'The vintage appears on the label.')
  const threshold = kind === 'ava' || kind === 'foreign_viticultural_area' ? 95 : 85
  if (application.source === 'imported' && application.wineForeignLawCompliant === undefined) return missingContextCard(rule, 'foreign-law vintage evidence')
  const importedContainerConflict = application.source === 'imported' && application.containerVolumeMl > 5_000
  const foreignSupport = application.source !== 'imported' || application.wineForeignLawCompliant === true
  const passes = percentage >= threshold && !importedContainerConflict && foreignSupport
  return card(rule, passes ? 'pass' : 'mismatch', vintage, passes ? `The vintage has ${percentage}% harvest-year support, satisfying the ${threshold}% threshold.` : `This vintage requires ${threshold}% harvest-year support, compliant foreign context when imported, and an imported container no larger than 5 liters.`)
}

function estateCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  if (!application.wineAppellation || !application.wineAppellationType) return missingContextCard(rule, 'estate appellation context')
  if (!phraseMatches('ESTATE BOTTLED', text)) return textEvidenceCard(rule, text, confidence, ['ESTATE BOTTLED'], 'The estate claim appears on the label.')
  if (application.wineAppellationPercentage === undefined || application.wineEstateProductionContinuous === undefined || application.wineFinishedInRequiredArea === undefined) return missingContextCard(rule, 'estate grape-origin or continuous-production evidence')
  const passes = application.wineAppellationType === 'ava'
    && application.wineAppellationPercentage === 100
    && application.wineEstateProductionContinuous === true
    && application.wineFinishedInRequiredArea === true
  return card(rule, passes ? 'pass' : 'mismatch', 'ESTATE BOTTLED', passes ? 'The viticultural-area, 100% grape-origin, and continuous estate-production facts support the claim.' : 'Estate bottled requires a qualifying viticultural area, 100% qualifying grapes, and continuous production on the estate premises.')
}

function foreignPercentageCard(rule: RuleApplicability, application: ApplicationData, text: string, confidence: number) {
  const percentage = application.wineForeignPercentage
  if (percentage === undefined) return missingContextCard(rule, 'foreign-wine percentage')
  const detected = text.match(/(\d+(?:\.\d+)?)\s*%\s+FOREIGN\s+WINE/i)
  if (!detected) return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', 'Foreign-wine percentage not found', confidence < 68 ? 'OCR could not reliably resolve the required percentage.' : `Readable artwork omitted the required ${percentage}% foreign-wine statement.`)
  const observedPercentage = Number(detected[1])
  return card(rule, Math.abs(observedPercentage - percentage) < 0.01 ? 'pass' : 'mismatch', detected[0], Math.abs(observedPercentage - percentage) < 0.01 ? 'The exact foreign-wine percentage appears on the brand label.' : `The label states ${observedPercentage}%, but the supporting composition evidence requires ${percentage}%.`)
}

function sulfitesCard(rule: RuleApplicability, text: string, confidence: number) {
  const detected = text.match(/\bcontains\s+(?:(?:only\s+)?naturally\s+occurring\s+)?sul(?:f|ph)ites\b|\bcontains\s+(?:a\s+)?sulfiting\s+agents?\b/i)?.[0]
  if (detected) return card(rule, 'pass', detected, 'An authorized sulfite declaration was located.')
  return card(rule, confidence < 68 ? 'needs_review' : 'mismatch', 'Authorized sulfite declaration not found', confidence < 68 ? 'OCR could not reliably resolve the declaration.' : 'Readable artwork omitted the required sulfite declaration.')
}

function evaluatedRuleCard(rule: RuleApplicability, input: Input): ReviewCheck {
  if (rule.status === 'missing_context') return missingContextCard(rule)
  const { application, ocrText, ocrConfidence, coreChecks } = input
  switch (rule.rule.id) {
    case 'common.label-set-completeness': return labelSetCard(rule, application, ocrConfidence)
    case 'common.optional-information': return optionalInformationCard(rule, application, ocrText, ocrConfidence)
    case 'common.formula-labeling-instructions': return textEvidenceCard(rule, ocrText, ocrConfidence, application.formulaLabelingInstructions?.split('|') ?? [], 'Every formula-directed labeling statement was located.')
    case 'common.exemption-eligibility': return application.source === 'imported' ? card(rule, 'mismatch', 'Imported product', 'A certificate of exemption is unavailable for wine imported in bottles.') : card(rule, 'pass', 'Domestic wine', 'The source branch may proceed to State-limitation review.')
    case 'common.exemption-state-limitation': return textEvidenceCard(rule, ocrText, ocrConfidence, application.destinationState ? [`FOR SALE IN ${application.destinationState} ONLY`] : [], 'The State limitation matches the application.')
    case 'wine.under-seven-routing': return card(rule, 'pass', `${application.alcoholContent} · No Part 4 COLA review`, 'LabelEvidence routed the product to applicable TTB Parts 16 and 24 without implementing FDA rules.', undefined, { applicabilityExplanation: 'The application ABV is below 7%.', applicationEvidence: application.alcoholContent, labelEvidence: 'Part 4 review stopped; applicable TTB labeling cards remain below.' })
    case 'wine.under-seven-name-address': return nameAddressCard(rule, application, ocrText, ocrConfidence)
    case 'wine.under-seven-alcohol-content': return wineAlcoholCard(rule, application, ocrText, true)
    case 'wine.brand-label-placement': return brandLabelPlacementCard(rule, application, coreChecks, ocrText)
    case 'wine.alcohol-content': return wineAlcoholCard(rule, application, ocrText, Number(application.alcoholContent.match(/\d+(?:\.\d+)?/)?.[0]) > 14)
    case 'wine.name-address': return nameAddressCard(rule, application, ocrText, ocrConfidence)
    case 'wine.country-of-origin': return countryOriginCard(rule, application, ocrText)
    case 'wine.appellation': return appellationCard(rule, application, ocrText, ocrConfidence)
    case 'wine.varietal': return varietalCard(rule, application, ocrText, ocrConfidence)
    case 'wine.vintage': return vintageCard(rule, application, ocrText, ocrConfidence)
    case 'wine.estate-bottled': return estateCard(rule, application, ocrText, ocrConfidence)
    case 'wine.foreign-wine-percentage': return foreignPercentageCard(rule, application, ocrText, ocrConfidence)
    case 'wine.formula-composition': return textEvidenceCard(rule, ocrText, ocrConfidence, [application.formulaCompositionStatement ?? ''], 'The composition statement matches the approved formula wording.')
    case 'wine.sulfites': return sulfitesCard(rule, ocrText, ocrConfidence)
    case 'wine.yellow-5': return textEvidenceCard(rule, ocrText, ocrConfidence, ['CONTAINS FD&C YELLOW NO. 5', application.formulaCompositionStatement ?? ''], 'The color declaration and formula-consistent composition statement were located.')
    case 'wine.cochineal-carmine': {
      const evidence = `${application.formulaLabelingInstructions ?? ''} ${application.productionFacts ?? ''}`
      const declaration = /cochineal/i.test(evidence) ? 'CONTAINS COCHINEAL EXTRACT' : /carmine/i.test(evidence) ? 'CONTAINS CARMINE' : undefined
      return declaration ? textEvidenceCard(rule, ocrText, ocrConfidence, [declaration, application.formulaCompositionStatement ?? ''], 'The color declaration and composition statement were located.') : missingContextCard(rule, 'specific color additive')
    }
    default: return card(rule, 'needs_review', 'No specialized evaluator is available.', 'Review the cited requirement and evidence directly.')
  }
}

export function wineChecks(input: Input) {
  const selectedSource = input.ruleSetId === 'wine-7plus-imported' ? 'imported' : input.application.source
  const application = { ...input.application, source: selectedSource } as ApplicationData
  const evaluation = evaluateRuleSet(input.ruleSetId, {
    productType: 'wine',
    source: selectedSource,
    applicationType: application.applicationType,
    destinationState: application.destinationState,
    alcoholContent: Number(application.alcoholContent.match(/\d+(?:\.\d+)?/)?.[0]),
    containerVolumeMl: application.containerVolumeMl,
    brandName: application.brandName,
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
    containsYellow5: application.containsYellow5,
    containsCochinealOrCarmine: application.containsCochinealOrCarmine,
    sulfitesPpm: application.sulfitesPpm,
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
    importCountryOfOrigin: application.importCountryOfOrigin,
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
