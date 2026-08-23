import type {
  ApplicationRecord,
  EvidenceRecord,
  LabelArtifact,
  LabelEvidenceCase,
  RoutingCategory,
  RoutingCategoryId,
} from './types'

export const ROUTING_CATEGORIES: RoutingCategory[] = [
  { id: 'wine-domestic-at-least-7', label: 'Domestic wine — 7% ABV or higher', shortLabel: 'Domestic wine 7%+', commodity: 'wine', source: 'domestic', wineAbvBand: 'at_least_7' },
  { id: 'wine-imported-at-least-7', label: 'Imported wine — 7% ABV or higher', shortLabel: 'Imported wine 7%+', commodity: 'wine', source: 'imported', wineAbvBand: 'at_least_7' },
  { id: 'wine-domestic-under-7', label: 'Domestic wine — under 7% ABV', shortLabel: 'Domestic wine under 7%', commodity: 'wine', source: 'domestic', wineAbvBand: 'under_7' },
  { id: 'wine-imported-under-7', label: 'Imported wine — under 7% ABV', shortLabel: 'Imported wine under 7%', commodity: 'wine', source: 'imported', wineAbvBand: 'under_7' },
  { id: 'spirits-domestic', label: 'Domestic distilled spirits', shortLabel: 'Domestic spirits', commodity: 'distilled_spirits', source: 'domestic', wineAbvBand: 'not_applicable' },
  { id: 'spirits-imported', label: 'Imported distilled spirits', shortLabel: 'Imported spirits', commodity: 'distilled_spirits', source: 'imported', wineAbvBand: 'not_applicable' },
  { id: 'malt-domestic', label: 'Domestic malt beverages', shortLabel: 'Domestic malt', commodity: 'malt_beverage', source: 'domestic', wineAbvBand: 'not_applicable' },
  { id: 'malt-imported', label: 'Imported malt beverages', shortLabel: 'Imported malt', commodity: 'malt_beverage', source: 'imported', wineAbvBand: 'not_applicable' },
]

const BRAND_STEMS = ['Cedar Harbor', 'Northline', 'Golden Field', 'River Lantern', 'Stone Orchard', 'Blue Meridian', 'Juniper House']
const US_PARTIES = {
  wine: 'Bottled by Northline Cellars, Napa, CA',
  distilled_spirits: 'Produced and Bottled by Harbor Creek Distilling, Louisville, KY',
  malt_beverage: 'Brewed and Bottled by Golden Field Brewing, Denver, CO',
} as const
const IMPORT_PARTIES = ['Imported by Meridian Imports, Baltimore, MD', 'Imported by Harbor Trade Co., Newark, NJ', 'Imported by Northstar Beverage, Miami, FL']

function productValues(category: RoutingCategory, variant: number) {
  if (category.commodity === 'wine') {
    const flavored = variant === 2
    return {
      classType: flavored ? 'Grape wine with natural citrus flavor' : variant % 2 ? 'Red Wine' : 'Cabernet Sauvignon',
      alcoholContent: category.wineAbvBand === 'under_7' ? '6.5% Alc. by Vol.' : '13.5% Alc. by Vol.',
      netContents: variant % 2 ? '1 L' : '750 mL',
      ingredients: flavored ? ['grape wine', 'natural citrus flavor'] : ['grape wine'],
      formulaRequired: flavored,
      sulfitesPpm: 18,
    }
  }
  if (category.commodity === 'distilled_spirits') {
    const flavored = variant === 2
    return {
      classType: flavored ? 'Whiskey with natural cherry flavor' : variant % 2 ? 'Straight Bourbon Whiskey' : 'Vodka',
      alcoholContent: variant % 2 ? '45% Alc./Vol. (90 Proof)' : '40% Alc./Vol. (80 Proof)',
      netContents: variant % 2 ? '1 L' : '750 mL',
      ingredients: flavored ? ['whiskey', 'natural cherry flavor'] : ['distilled spirit', 'water'],
      formulaRequired: flavored,
      sulfitesPpm: 0,
    }
  }
  const flavored = variant === 2
  return {
    classType: flavored ? 'Ale brewed with orange peel' : variant % 2 ? 'India Pale Ale' : 'Lager',
    alcoholContent: variant % 2 ? '6.2% Alc. by Vol.' : '5.0% Alc. by Vol.',
    netContents: variant % 2 ? '16 FL. OZ.' : '12 FL. OZ.',
    ingredients: flavored ? ['malted barley', 'hops', 'orange peel', 'yeast', 'water'] : ['malted barley', 'hops', 'yeast', 'water'],
    formulaRequired: flavored,
    sulfitesPpm: variant === 6 ? 15 : 0,
  }
}

function baseCase(category: RoutingCategory, categoryIndex: number, variant: number): LabelEvidenceCase {
  const number = categoryIndex * 7 + variant + 1
  const caseId = `LE-${String(number).padStart(3, '0')}`
  const product = productValues(category, variant)
  const brandName = `${BRAND_STEMS[variant]} ${category.commodity === 'wine' ? 'Cellars' : category.commodity === 'distilled_spirits' ? 'Distilling' : 'Brewing'}`
  const countryOrigin = category.source === 'imported' ? ['France', 'Italy', 'Mexico', 'Canada'][variant % 4] : undefined
  const responsibleParty = category.source === 'imported' ? IMPORT_PARTIES[variant % IMPORT_PARTIES.length] : US_PARTIES[category.commodity]
  const formulaId = `F-${categoryIndex + 1}${variant + 1}-2026`
  const application: ApplicationRecord = {
    id: `APP-${caseId}`,
    categoryId: category.id,
    commodity: category.commodity,
    source: category.source,
    wineAbvBand: category.wineAbvBand,
    brandName,
    classType: product.classType,
    alcoholContent: product.alcoholContent,
    netContents: product.netContents,
    responsibleParty,
    countryOrigin,
    sulfitesPpm: product.sulfitesPpm,
    ingredients: product.ingredients,
    formula: product.formulaRequired
      ? { required: true, status: 'approved', id: formulaId, labelingInstructions: product.classType }
      : { required: false, status: 'not_required' },
    ageYears: category.commodity === 'distilled_spirits' && variant === 3 ? 4 : undefined,
    ageOriginEvidenceRequired: category.id === 'spirits-imported' && variant === 3,
  }

  const evidence: EvidenceRecord[] = [
    {
      id: `production-${caseId}`,
      type: 'production',
      title: 'Product record',
      status: 'available',
      supports: ['product identity', 'alcohol content', 'responsible party'],
    },
  ]
  if (product.formulaRequired) {
    evidence.push({ id: `formula-${caseId}`, type: 'formula', title: `Approved formula ${formulaId}`, status: 'available', supports: ['formula approval', 'class and type', 'statement of composition'] })
  }
  if (application.ageOriginEvidenceRequired) {
    evidence.push({ id: `age-${caseId}`, type: 'age_origin', title: 'Age and origin record', status: 'available', supports: ['age', 'origin'] })
  }

  const label: LabelArtifact = {
    brandName,
    classType: product.classType,
    alcoholContent: product.alcoholContent,
    netContents: product.netContents,
    responsibleParty,
    countryOrigin,
    declarations: product.sulfitesPpm >= 10 ? ['Contains Sulfites'] : [],
    warning: {
      present: true,
      exactText: true,
      headingCapitalized: true,
      headingBold: true,
      minimumTypeSizeMet: true,
      contrastMet: true,
    },
    claims: [],
    imageQuality: 'clear',
    difficultAreas: [],
  }

  applyControlledProblem(category.id, variant, application, evidence, label)

  return {
    id: caseId,
    displayName: `${brandName} · ${String(variant + 1).padStart(2, '0')}`,
    category,
    application,
    evidence,
    label,
  }
}

function applyControlledProblem(
  categoryId: RoutingCategoryId,
  variant: number,
  application: ApplicationRecord,
  evidence: EvidenceRecord[],
  label: LabelArtifact,
) {
  const secondProblemCase = !['malt-domestic', 'malt-imported'].includes(categoryId)
  const hasProblem = variant === 6 || (variant === 5 && secondProblemCase)
  if (!hasProblem) return

  switch (categoryId) {
    case 'wine-domestic-at-least-7':
      if (variant === 5) label.brandName = application.brandName.replace('Blue', 'Blu')
      else label.warning.present = false
      break
    case 'wine-imported-at-least-7':
      if (variant === 5) label.countryOrigin = undefined
      else {
        label.imageQuality = 'limited'
        label.difficultAreas = ['responsible party', 'net contents']
      }
      break
    case 'wine-domestic-under-7':
      if (variant === 5) label.responsibleParty = undefined
      else label.claims.push({ text: 'A healthy choice', type: 'health' })
      break
    case 'wine-imported-under-7':
      if (variant === 5) label.alcoholContent = '5.5% Alc. by Vol.'
      else label.claims.push({ text: 'USDA Organic', type: 'organic' })
      break
    case 'spirits-domestic':
      if (variant === 5) {
        application.classType = 'Whiskey with natural flavor'
        application.ingredients.push('natural flavor')
        application.formula = { required: true, status: 'missing', labelingInstructions: application.classType }
        label.classType = application.classType
        evidence.splice(0, evidence.length, ...evidence.filter((item) => item.type !== 'formula'))
      } else label.classType = `${application.classType} Specialty`
      break
    case 'spirits-imported':
      if (variant === 5) {
        application.ageOriginEvidenceRequired = true
        evidence.push({ id: `age-missing-${application.id}`, type: 'age_origin', title: 'Age and origin record', status: 'missing', supports: ['age', 'origin'] })
      } else label.countryOrigin = 'United States'
      break
    case 'malt-domestic':
      label.declarations = label.declarations.filter((value) => value.toLowerCase() !== 'contains sulfites')
      break
    case 'malt-imported':
      label.warning.headingCapitalized = false
      label.warning.headingBold = false
      break
  }
}

export const LABEL_EVIDENCE_CASES: LabelEvidenceCase[] = ROUTING_CATEGORIES.flatMap((category, categoryIndex) =>
  Array.from({ length: 7 }, (_, variant) => baseCase(category, categoryIndex, variant)),
)

export function casesForCategory(categoryId: RoutingCategoryId) {
  return LABEL_EVIDENCE_CASES.filter((item) => item.category.id === categoryId)
}
