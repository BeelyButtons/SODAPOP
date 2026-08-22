import type { CheckStatus, ReviewCheck } from './reviewSchema'

export type ReviewSectionId =
  | 'application'
  | 'identity'
  | 'alcohol_quantity'
  | 'responsible_party_origin'
  | 'government_warning'
  | 'formula_disclosures'
  | 'other_claims'

export type ReviewSectionStatus = CheckStatus | 'not_applicable'

export type ReviewSection = {
  id: ReviewSectionId
  title: string
  description: string
  status: ReviewSectionStatus
  checks: ReviewCheck[]
  counts: Record<CheckStatus, number>
}

const SECTION_DEFINITIONS: ReadonlyArray<Pick<ReviewSection, 'id' | 'title' | 'description'>> = [
  {
    id: 'application',
    title: 'Application completeness',
    description: 'Submitted artwork, application type, and supporting evidence needed for review.',
  },
  {
    id: 'identity',
    title: 'Product identity',
    description: 'Brand, class or type, geographic identity, and other product-designation requirements.',
  },
  {
    id: 'alcohol_quantity',
    title: 'Alcohol and net contents',
    description: 'Alcohol statements, proof, container capacity, and net-content requirements.',
  },
  {
    id: 'responsible_party_origin',
    title: 'Responsible party and origin',
    description: 'Producer, bottler, importer, address, origin, and production-location requirements.',
  },
  {
    id: 'government_warning',
    title: 'Government warning',
    description: 'Required warning wording, heading, formatting, contrast, and placement.',
  },
  {
    id: 'formula_disclosures',
    title: 'Formula and required disclosures',
    description: 'Formula-directed wording, composition statements, ingredients, colors, and additives.',
  },
  {
    id: 'other_claims',
    title: 'Other claims',
    description: 'Age, maturity, production, optional marketing, and other representations.',
  },
]

const applicationTerms = [
  'label-set-completeness',
  'distinctive-bottle',
  'exemption-eligibility',
  'exemption-state-limitation',
  'under-seven-routing',
]
const identityTerms = [
  'brand',
  'class-type',
  'class.type',
  'kind-designation',
  'fanciful',
  'appellation',
  'varietal',
  'vintage',
  'estate-bottled',
  'geographic-designation',
  'mandatory-language-location',
  'same-field-of-vision',
]
const alcoholQuantityTerms = [
  'alcohol',
  'proof',
  'net-contents',
  'netcontents',
  'significant-solids',
  'neutral-spirits',
]
const responsiblePartyTerms = [
  'name-address',
  'country-of-origin',
  'import-bottling',
  'importer',
  'bottler',
  'responsible-party',
  'state-of-distillation',
  'place-of-production',
]
const warningTerms = ['health-warning', 'warningtext', 'warningformat', 'warning-wording', 'warning-format']
const formulaTerms = [
  'formula',
  'composition',
  'yellow-5',
  'cochineal',
  'carmine',
  'sulfite',
  'aspartame',
  'color-',
  'wood-treatment',
  'foreign-wine-percentage',
]

function includesAny(id: string, terms: readonly string[]) {
  return terms.some((term) => id.includes(term))
}

export function sectionIdForCheck(check: ReviewCheck): ReviewSectionId {
  const id = `${check.ruleId ?? ''} ${check.id}`.toLowerCase()
  if (includesAny(id, warningTerms)) return 'government_warning'
  if (includesAny(id, applicationTerms)) return 'application'
  if (includesAny(id, formulaTerms)) return 'formula_disclosures'
  if (includesAny(id, responsiblePartyTerms)) return 'responsible_party_origin'
  if (includesAny(id, alcoholQuantityTerms)) return 'alcohol_quantity'
  if (includesAny(id, identityTerms)) return 'identity'
  return 'other_claims'
}

function sectionStatus(checks: ReviewCheck[]): ReviewSectionStatus {
  if (!checks.length) return 'not_applicable'
  if (checks.some((check) => check.status === 'mismatch')) return 'mismatch'
  if (checks.some((check) => check.status === 'needs_review')) return 'needs_review'
  return 'pass'
}

export function buildReviewSections(checks: ReviewCheck[]): ReviewSection[] {
  return SECTION_DEFINITIONS.map((definition) => {
    const sectionChecks = checks.filter((check) => sectionIdForCheck(check) === definition.id)
    return {
      ...definition,
      status: sectionStatus(sectionChecks),
      checks: sectionChecks,
      counts: {
        mismatch: sectionChecks.filter((check) => check.status === 'mismatch').length,
        needs_review: sectionChecks.filter((check) => check.status === 'needs_review').length,
        pass: sectionChecks.filter((check) => check.status === 'pass').length,
      },
    }
  })
}

