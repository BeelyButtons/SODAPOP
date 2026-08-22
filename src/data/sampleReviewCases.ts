import { SAMPLE_LABELS, type SampleLabel } from './sampleLabels'
import type { EvidenceRecord, ReviewCaseFile, ReviewClaim } from '../domain/reviewCaseFile'

type SampleId = SampleLabel['id']

type CaseDefinition = {
  caseId: string
  sampleLabelId: SampleId
  title: string
  authorization?: Partial<ReviewCaseFile['applicantAuthorization']>
  determination?: Partial<ReviewCaseFile['productDetermination']>
  evidence?: EvidenceRecord[]
  claims?: ReviewClaim[]
  labelPackage?: Partial<ReviewCaseFile['labelPackage']>
}

function applicationFor(sampleLabelId: SampleId) {
  const sample = SAMPLE_LABELS.find((candidate) => candidate.id === sampleLabelId)
  if (!sample) throw new Error(`Missing label sample for case file: ${sampleLabelId}`)
  return { ...sample.application }
}

function recordTypeFor(application: ReviewCaseFile['application']) {
  if (application.productType === 'malt_beverage' && application.source === 'domestic') return 'brewers_notice' as const
  if (application.source === 'imported') return 'basic_permit' as const
  return 'plant_registry' as const
}

function authorizationOperation(application: ReviewCaseFile['application']) {
  if (application.source === 'imported') return `Importation of ${application.productType.replace('_', ' ')}`
  if (application.productType === 'malt_beverage') return 'Brewing and packaging malt beverages'
  if (application.productType === 'wine') return 'Wine production and bottling'
  return 'Distilled spirits processing and bottling'
}

function defaultDetermination(application: ReviewCaseFile['application']): ReviewCaseFile['productDetermination'] {
  if (!application.formulaRequired) {
    return {
      required: false,
      status: 'not_required',
      labelingInstructions: [],
      explanation: 'This synthetic product does not require formula approval before label review.',
    }
  }
  if (!application.formulaId) {
    return {
      required: true,
      status: 'missing',
      labelingInstructions: [],
      explanation: 'The application identifies a formula-required product, but no approved formula is linked to the case.',
    }
  }
  return {
    required: true,
    status: 'approved',
    formulaId: application.formulaId,
    classType: application.formulaClassType,
    compositionStatement: application.formulaCompositionStatement,
    labelingInstructions: application.formulaLabelingInstructions?.split('|').filter(Boolean) ?? [],
    explanation: 'The approved synthetic formula is linked to this applicant and supplies the product identity and labeling instructions.',
  }
}

function buildCase(definition: CaseDefinition): ReviewCaseFile {
  const application = applicationFor(definition.sampleLabelId)
  const defaultContainerEvidenceRequired = Boolean(application.distinctiveBottleRequested)
  const defaultContainerEvidenceProvided = defaultContainerEvidenceRequired && Boolean(application.bottleDesignEvidence)
  return {
    caseId: definition.caseId,
    sampleLabelId: definition.sampleLabelId,
    title: definition.title,
    application,
    applicantAuthorization: {
      status: 'verified',
      recordType: recordTypeFor(application),
      recordNumber: `SYNTHETIC-${definition.caseId.toUpperCase()}`,
      legalName: application.permitName ?? application.applicantName,
      address: application.permitAddress ?? application.applicantAddress,
      approvedTradeNames: [],
      authorizedOperations: [authorizationOperation(application)],
      explanation: 'The synthetic authorization record supports the applicant, location, and operation used in this case.',
      ...definition.authorization,
    },
    productDetermination: { ...defaultDetermination(application), ...definition.determination },
    evidence: definition.evidence ?? [],
    claims: definition.claims ?? [],
    labelPackage: {
      panels: [{ id: `${definition.caseId}-artwork`, role: 'front', present: true, description: 'Complete submitted label artwork' }],
      translationsRequired: application.source === 'imported',
      translationsProvided: application.source === 'imported',
      physicalDimensionsKnown: true,
      containerCapacityMl: application.containerVolumeMl,
      containerEvidenceRequired: defaultContainerEvidenceRequired,
      containerEvidenceProvided: defaultContainerEvidenceProvided,
      ...definition.labelPackage,
    },
    history: [{ date: '2026-08-22', event: 'created', summary: 'Synthetic reviewer pilot case created.' }],
  }
}

function supporting(id: string, kind: EvidenceRecord['kind'], title: string, summary: string): EvidenceRecord {
  return { id, kind, title, authority: 'supporting_record', assessment: 'supports', summary }
}

function formulaRecord(id: string, assessment: EvidenceRecord['assessment'], summary: string, reference: string): EvidenceRecord {
  return {
    id,
    kind: 'approved_formula',
    title: 'Approved synthetic formula determination',
    authority: 'authoritative_determination',
    assessment,
    reference,
    issuer: 'Synthetic TTB formula record',
    summary,
  }
}

function claim(id: string, kind: ReviewClaim['kind'], statement: string, evidenceIds: string[]): ReviewClaim {
  return { id, kind, statement, evidenceRequired: true, evidenceIds }
}

export const SAMPLE_REVIEW_CASES: readonly ReviewCaseFile[] = [
  buildCase({
    caseId: 'spirits-domestic-standard',
    sampleLabelId: 'valid',
    title: 'Domestic standard spirit — no formula required',
    evidence: [supporting('spirits-domestic-production', 'production_record', 'Synthetic bourbon production record', 'Production records support the stated Kentucky straight bourbon identity and documented age.')],
    claims: [claim('spirits-domestic-identity', 'identity', 'Kentucky Straight Bourbon Whiskey', ['spirits-domestic-production'])],
  }),
  buildCase({
    caseId: 'spirits-domestic-specialty',
    sampleLabelId: 'conditional-disclosures',
    title: 'Domestic spirits specialty — formula and disclosures',
    evidence: [formulaRecord('spirits-specialty-formula', 'supports', 'The formula supports the orange liqueur composition and required additive disclosures.', 'SDS-2026-1042')],
    claims: [claim('spirits-specialty-composition', 'composition', 'Orange liqueur with natural flavors', ['spirits-specialty-formula'])],
  }),
  buildCase({
    caseId: 'spirits-imported-protected',
    sampleLabelId: 'imported-clear',
    title: 'Imported protected spirit — age and origin evidence',
    evidence: [{
      id: 'spirits-import-application-claim',
      kind: 'application_statement',
      title: 'Applicant’s age and origin statement',
      authority: 'applicant_assertion',
      assessment: 'supports',
      summary: 'The applicant identifies the product as eight-year-old single malt Scotch whisky, but no qualifying certificate is attached.',
    }],
    claims: [claim('spirits-import-age-origin', 'age', '8-year-old Single Malt Scotch Whisky', ['spirits-import-application-claim'])],
  }),
  buildCase({
    caseId: 'spirits-exemption-bottle',
    sampleLabelId: 'exemption-distinctive',
    title: 'Intrastate exemption and distinctive bottle',
    evidence: [supporting('spirits-bottle-evidence', 'container_evidence', 'Synthetic distinctive bottle packet', 'Front, back, side, closure, capacity, and dimensional bottle evidence is complete.')],
  }),
  buildCase({
    caseId: 'wine-domestic-claims',
    sampleLabelId: 'wine-domestic-complete',
    title: 'Domestic wine — appellation, varietal, and vintage',
    evidence: [
      supporting('wine-domestic-origin', 'production_record', 'Synthetic Napa Valley sourcing records', 'Records support the Napa Valley appellation and Cabernet Sauvignon percentage.'),
      supporting('wine-domestic-vintage', 'production_record', 'Synthetic 2023 harvest records', 'Records support the stated 2023 vintage percentage.'),
    ],
    claims: [
      claim('wine-domestic-appellation', 'wine_appellation', 'Napa Valley', ['wine-domestic-origin']),
      claim('wine-domestic-varietal', 'wine_varietal', 'Cabernet Sauvignon', ['wine-domestic-origin']),
      claim('wine-domestic-vintage', 'wine_vintage', '2023 vintage', ['wine-domestic-vintage']),
    ],
  }),
  buildCase({
    caseId: 'wine-domestic-specialty',
    sampleLabelId: 'wine-formula-missing',
    title: 'Domestic specialty wine — required formula missing',
    determination: {
      required: true,
      status: 'missing',
      formulaId: undefined,
      classType: undefined,
      compositionStatement: undefined,
      labelingInstructions: [],
      explanation: 'The specialty wine requires pre-COLA formula approval, but the case does not contain an approved formula.',
    },
  }),
  buildCase({
    caseId: 'wine-imported',
    sampleLabelId: 'wine-imported-complete',
    title: 'Imported wine — origin, vintage, and foreign records',
    evidence: [
      supporting('wine-imported-origin', 'production_record', 'Synthetic Bordeaux production record', 'Foreign production records support the stated Bordeaux origin.'),
      supporting('wine-imported-vintage', 'production_record', 'Synthetic 2022 vintage record', 'Foreign production records support the stated 2022 vintage.'),
      supporting('wine-imported-certification', 'natural_wine_certificate', 'Synthetic imported natural wine certification', 'The required certification status is documented for this foreign producer and product.'),
    ],
    claims: [
      claim('wine-imported-origin-claim', 'wine_appellation', 'Bordeaux', ['wine-imported-origin']),
      claim('wine-imported-vintage-claim', 'wine_vintage', '2022 vintage', ['wine-imported-vintage']),
    ],
  }),
  buildCase({
    caseId: 'wine-under-seven',
    sampleLabelId: 'wine-under-seven-complete',
    title: 'Wine below 7% — TTB jurisdiction routing',
    determination: {
      required: false,
      status: 'not_required',
      labelingInstructions: [],
      explanation: 'The case routes outside ordinary Part 4 COLA review while retaining the applicable demonstrated TTB Part 24 and health-warning checks.',
    },
  }),
  buildCase({
    caseId: 'malt-domestic-standard',
    sampleLabelId: 'malt-domestic-lager',
    title: 'Domestic ordinary malt beverage',
    evidence: [supporting('malt-domestic-production', 'production_record', 'Synthetic brewery production record', 'The brewing record supports an ordinary domestic lager identity.')],
    claims: [claim('malt-domestic-identity', 'identity', 'Lager', ['malt-domestic-production'])],
  }),
  buildCase({
    caseId: 'malt-domestic-specialty',
    sampleLabelId: 'malt-specialty-conflict',
    title: 'Domestic flavored malt specialty — formula conflict',
    determination: {
      required: true,
      status: 'conflict',
      explanation: 'The application and label describe a natural tangerine flavor, but the approved synthetic formula requires natural and artificial tangerine flavor wording.',
    },
    evidence: [formulaRecord('malt-specialty-formula', 'contradicts', 'The approved formula contradicts the natural-flavor-only composition statement.', 'MB-2026-0881')],
    claims: [claim('malt-specialty-composition', 'composition', 'Malt beverage with natural tangerine flavor', ['malt-specialty-formula'])],
  }),
  buildCase({
    caseId: 'malt-imported-bottled',
    sampleLabelId: 'malt-imported-pilsner',
    title: 'Imported malt beverage — bottled abroad',
    evidence: [supporting('malt-imported-origin', 'producer_letter', 'Synthetic foreign producer letter', 'The producer letter supports German production and bottling before importation.')],
    claims: [claim('malt-imported-origin-claim', 'origin', 'Product of Germany', ['malt-imported-origin'])],
  }),
  buildCase({
    caseId: 'malt-imported-bulk',
    sampleLabelId: 'malt-post-import-complete',
    title: 'Imported malt beverage — packaged in the United States',
    evidence: [
      supporting('malt-bulk-producer', 'producer_letter', 'Synthetic foreign producer record', 'The record supports production in Mexico before bulk importation.'),
      supporting('malt-us-packaging', 'production_record', 'Synthetic U.S. packaging record', 'The record supports canning in San Diego without blending or further production.'),
    ],
    claims: [claim('malt-bulk-origin', 'origin', 'Produced in Mexico and canned in the United States', ['malt-bulk-producer', 'malt-us-packaging'])],
  }),
]
