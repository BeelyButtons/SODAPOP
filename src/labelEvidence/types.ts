export type Commodity = 'wine' | 'distilled_spirits' | 'malt_beverage'
export type ProductSource = 'domestic' | 'imported'
export type WineAbvBand = 'under_7' | 'at_least_7' | 'not_applicable'

export type RoutingCategoryId =
  | 'wine-domestic-at-least-7'
  | 'wine-imported-at-least-7'
  | 'wine-domestic-under-7'
  | 'wine-imported-under-7'
  | 'spirits-domestic'
  | 'spirits-imported'
  | 'malt-domestic'
  | 'malt-imported'

export interface RoutingCategory {
  id: RoutingCategoryId
  label: string
  shortLabel: string
  commodity: Commodity
  source: ProductSource
  wineAbvBand: WineAbvBand
}

export interface FormulaRecord {
  required: boolean
  status: 'approved' | 'not_required' | 'missing'
  id?: string
  labelingInstructions?: string
}

export interface ApplicationRecord {
  id: string
  categoryId: RoutingCategoryId
  commodity: Commodity
  source: ProductSource
  wineAbvBand: WineAbvBand
  brandName: string
  classType: string
  alcoholContent: string
  netContents: string
  responsibleParty: string
  countryOrigin?: string
  sulfitesPpm: number
  ingredients: string[]
  formula: FormulaRecord
  ageYears?: number
  ageOriginEvidenceRequired?: boolean
}

export interface EvidenceRecord {
  id: string
  type: 'formula' | 'age_origin' | 'organic' | 'production' | 'laboratory'
  title: string
  status: 'available' | 'missing'
  supports: string[]
}

export interface LabelClaim {
  text: string
  type: 'organic' | 'natural' | 'health' | 'age' | 'origin' | 'other'
}

export interface LabelArtifact {
  brandName?: string
  classType?: string
  alcoholContent?: string
  netContents?: string
  responsibleParty?: string
  countryOrigin?: string
  declarations: string[]
  warning: {
    present: boolean
    exactText: boolean
    headingCapitalized: boolean
    headingBold: boolean
    minimumTypeSizeMet: boolean
    contrastMet: boolean
  }
  claims: LabelClaim[]
  imageQuality: 'clear' | 'limited'
  difficultAreas: string[]
}

export interface LabelEvidenceCase {
  id: string
  displayName: string
  category: RoutingCategory
  application: ApplicationRecord
  evidence: EvidenceRecord[]
  label: LabelArtifact
}

export type ReviewFlagKind =
  | 'mismatch'
  | 'missing'
  | 'claim'
  | 'prohibited_claim'
  | 'evidence'
  | 'image_quality'
  | 'warning'

export interface ReviewFlag {
  id: string
  kind: ReviewFlagKind
  title: string
  detail: string
  applicationValue?: string
  labelValue?: string
}

export interface ReviewCheckResult {
  id: string
  label: string
  status: 'confirmed' | 'flagged'
  detail: string
  expected: string
  observed: string
}

export interface CaseEvaluation {
  caseId: string
  categoryId: RoutingCategoryId
  flags: ReviewFlag[]
  checks: ReviewCheckResult[]
  reviewedAt: string
}
