import { INITIAL_APPLICATION, type ApplicationData } from '../domain/reviewSchema'

type SampleVariant =
  | 'valid'
  | 'wrong-abv'
  | 'warning-case'
  | 'warning-bold'
  | 'missing-warning'
  | 'angled-photo'
  | 'glare-photo'
  | 'dark-label'
  | 'upside-down'
  | 'imported-clear'
  | 'imported-origin-mismatch'
  | 'imported-age-understatement'
  | 'imported-age-overstatement'
  | 'conditional-disclosures'
  | 'conditional-missing'
  | 'formula-composition-conflict'
  | 'blur-photo'
  | 'partial-obstruction'
  | 'missing-context'
  | 'routing-override'
  | 'production-disclosures'
  | 'significant-solids'
  | 'exemption-distinctive'
  | 'wine-domestic-complete'
  | 'wine-varietal-support-conflict'
  | 'wine-estate-complete'
  | 'wine-imported-complete'
  | 'wine-imported-origin-conflict'
  | 'wine-formula-complete'
  | 'wine-formula-missing'
  | 'wine-formula-conflict'
  | 'wine-under-seven-complete'
  | 'wine-under-seven-missing'
  | 'wine-glare-photo'

export type SampleLabel = {
  id: SampleVariant
  name: string
  description: string
  application: ApplicationData
}

const EMBER_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'EMBER & ASH',
  classType: 'STRAIGHT RYE WHISKEY',
  alcoholContent: '50% Alc./Vol. (100 Proof)',
  netContents: '750 mL',
  containerVolumeMl: 750,
  applicantName: 'EMBER & ASH DISTILLING',
  applicantAddress: 'LOUISVILLE, KENTUCKY',
  permitName: 'EMBER & ASH DISTILLING',
  permitAddress: 'LOUISVILLE, KENTUCKY',
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'Straight rye whisky production facts verified; no optional age claim.',
}

const HARBOR_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'HARBOR LIGHT',
  classType: 'AMERICAN DRY GIN',
  alcoholContent: '42% Alc./Vol. (84 Proof)',
  netContents: '1 L',
  containerVolumeMl: 1_000,
  applicantName: 'HARBOR LIGHT SPIRITS',
  applicantAddress: 'PORTLAND, MAINE',
  permitName: 'HARBOR LIGHT SPIRITS',
  permitAddress: 'PORTLAND, MAINE',
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'American dry gin production facts verified.',
}

const ORCHARD_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'NIGHT ORCHARD',
  classType: 'APPLE BRANDY',
  alcoholContent: '40% Alc./Vol. (80 Proof)',
  netContents: '375 mL',
  containerVolumeMl: 375,
  applicantName: 'NIGHT ORCHARD SPIRITS',
  applicantAddress: 'HUDSON, NEW YORK',
  permitName: 'NIGHT ORCHARD SPIRITS',
  permitAddress: 'HUDSON, NEW YORK',
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'Apple brandy production facts verified.',
}

const IMPORTED_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  source: 'imported',
  brandName: 'NORTH SEA RESERVE',
  classType: 'SINGLE MALT SCOTCH WHISKY',
  alcoholContent: '46% Alc./Vol. (92 Proof)',
  netContents: '700 mL',
  containerVolumeMl: 700,
  applicantName: 'ATLANTIC IMPORTS LLC',
  applicantAddress: 'BALTIMORE, MARYLAND',
  permitName: 'ATLANTIC IMPORTS LLC',
  permitAddress: 'BALTIMORE, MARYLAND',
  importCountryOfOrigin: 'SCOTLAND',
  importBottlingDisposition: 'Imported in the labeled bottle',
  requiresAgeStatement: false,
  spiritsAgeOrMaturityClaim: true,
  productionFacts: 'Youngest applicable spirit aged 8 years. Reserve brand wording supported by the product identity.',
}

const CONDITIONAL_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'CITRUS FORGE',
  classType: 'DISTILLED SPIRITS SPECIALTY',
  fancifulName: 'GOLDEN CITRUS',
  alcoholContent: '30% Alc./Vol. (60 Proof)',
  netContents: '750 mL',
  formulaRequired: true,
  formulaId: 'SDS-2026-1042',
  formulaClassType: 'DISTILLED SPIRITS SPECIALTY',
  formulaCompositionStatement: 'ORANGE LIQUEUR WITH NATURAL FLAVORS',
  formulaLabelingInstructions: 'ORANGE LIQUEUR WITH NATURAL FLAVORS|CONTAINS FD&C YELLOW NO. 5|CONTAINS SULFITES|PHENYLKETONURICS: CONTAINS PHENYLALANINE',
  applicantName: 'CITRUS FORGE SPIRITS',
  applicantAddress: 'TAMPA, FLORIDA',
  permitName: 'CITRUS FORGE SPIRITS',
  permitAddress: 'TAMPA, FLORIDA',
  containsYellow5: true,
  sulfitesPpm: 18,
  containsAspartame: true,
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'Approved specialty formula and composition facts verified.',
}

const MISSING_CONTEXT_APPLICATION: ApplicationData = {
  productType: 'distilled_spirits',
  source: 'domestic',
  brandName: 'PACKET GAP',
  classType: 'VODKA',
  alcoholContent: '40% Alc./Vol. (80 Proof)',
  netContents: '750 mL',
  containerVolumeMl: 750,
  applicationType: 'cola',
  labelSet: true,
}

const ROUTING_OVERRIDE_APPLICATION: ApplicationData = {
  ...IMPORTED_APPLICATION,
  source: 'domestic',
  brandName: 'ROUTING CHECK',
}

const PRODUCTION_DISCLOSURE_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'WOODLAND PROOF',
  classType: 'AMERICAN WHISKEY SPECIALTY',
  alcoholContent: '40% Alc./Vol. (80 Proof)',
  formulaRequired: true,
  formulaId: 'SDS-2026-1188',
  formulaClassType: 'AMERICAN WHISKEY SPECIALTY',
  formulaCompositionStatement: 'AMERICAN WHISKEY WITH NATURAL FLAVORS',
  formulaLabelingInstructions: 'AMERICAN WHISKEY WITH NATURAL FLAVORS|50% NEUTRAL SPIRITS DISTILLED FROM CORN|COLORED AND FLAVORED WITH OAK CHIPS|DISTILLED IN KENTUCKY|CONTAINS CARMINE',
  applicantName: 'WOODLAND PROOF DISTILLING',
  applicantAddress: 'LEXINGTON, KENTUCKY',
  permitName: 'WOODLAND PROOF DISTILLING',
  permitAddress: 'LEXINGTON, KENTUCKY',
  containsNeutralSpirits: true,
  requiresWoodTreatmentDisclosure: true,
  requiresStateOfDistillation: true,
  containsCochinealOrCarmine: true,
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'Wood treatment disclosure: COLORED AND FLAVORED WITH OAK CHIPS. State of distillation: DISTILLED IN KENTUCKY. Neutral spirits and color facts verified by formula.',
}

const SIGNIFICANT_SOLIDS_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'ORCHARD ORBIT',
  classType: 'CHERRY LIQUEUR',
  alcoholContent: '24% Alc./Vol.',
  formulaRequired: true,
  formulaId: 'SDS-2026-1201',
  formulaClassType: 'DISTILLED SPIRITS SPECIALTY',
  formulaCompositionStatement: 'CHERRY LIQUEUR WITH WHOLE CHERRIES',
  formulaLabelingInstructions: 'CHERRY LIQUEUR WITH WHOLE CHERRIES',
  applicantName: 'ORCHARD ORBIT SPIRITS',
  applicantAddress: 'TRAVERSE CITY, MICHIGAN',
  permitName: 'ORCHARD ORBIT SPIRITS',
  permitAddress: 'TRAVERSE CITY, MICHIGAN',
  containsSignificantSolids: true,
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'Whole cherries remain in the container; bottling strength is 24 percent alcohol by volume.',
}

const EXEMPTION_DISTINCTIVE_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'COMMONWEALTH',
  classType: 'VODKA',
  alcoholContent: '40% Alc./Vol. (80 Proof)',
  applicationType: 'exemption',
  destinationState: 'VIRGINIA',
  distinctiveBottleRequested: true,
  bottleDesignEvidence: 'Front, back, side, closure, and dimensional bottle views supplied and internally consistent.',
  applicantName: 'COMMONWEALTH SPIRITS',
  applicantAddress: 'RICHMOND, VIRGINIA',
  permitName: 'COMMONWEALTH SPIRITS',
  permitAddress: 'RICHMOND, VIRGINIA',
  spiritsAgeOrMaturityClaim: false,
  productionFacts: 'Domestic vodka for intrastate Virginia sale; distinctive bottle packet complete.',
}

const DOMESTIC_WINE_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  productType: 'wine',
  source: 'domestic',
  brandName: 'RIDGE & RIVER',
  classType: 'CABERNET SAUVIGNON',
  alcoholContent: '13.5% Alc. by Vol.',
  netContents: '750 mL',
  applicantName: 'RIDGE & RIVER WINERY',
  applicantAddress: 'ST. HELENA, CALIFORNIA',
  permitName: 'RIDGE & RIVER WINERY',
  permitAddress: 'ST. HELENA, CALIFORNIA',
  formulaRequired: false,
  labelDimensions: 'Complete single brand-label face; 4 × 6 inches',
  sulfitesPpm: 18,
  wineAppellation: 'NAPA VALLEY',
  wineAppellationType: 'ava',
  wineAppellationPercentage: 90,
  wineFinishedInRequiredArea: true,
  wineVarietals: [{ name: 'CABERNET SAUVIGNON', percentage: 80 }],
  wineVintage: '2023',
  wineVintagePercentage: 96,
  wineEstateBottledClaim: false,
  wineForeignBlendReferenced: false,
  productionFacts: 'Napa Valley origin, Cabernet Sauvignon percentage, 2023 harvest, and California finishing records verified.',
}

const WINE_VARIETAL_CONFLICT_APPLICATION: ApplicationData = {
  ...DOMESTIC_WINE_APPLICATION,
  wineVarietals: [{ name: 'CABERNET SAUVIGNON', percentage: 60 }],
  productionFacts: 'Only 60 percent Cabernet Sauvignon documented; remaining wine is other red varieties.',
}

const ESTATE_WINE_APPLICATION: ApplicationData = {
  ...DOMESTIC_WINE_APPLICATION,
  brandName: 'STONE ARBOR',
  classType: 'CHARDONNAY',
  alcoholContent: '12.8% Alc. by Vol.',
  applicantName: 'STONE ARBOR ESTATE',
  applicantAddress: 'SONOMA, CALIFORNIA',
  permitName: 'STONE ARBOR ESTATE',
  permitAddress: 'SONOMA, CALIFORNIA',
  sulfitesPpm: 16,
  wineAppellation: 'SONOMA VALLEY',
  wineAppellationPercentage: 100,
  wineVarietals: [{ name: 'CHARDONNAY', percentage: 85 }],
  wineVintage: '',
  wineVintagePercentage: undefined,
  wineEstateBottledClaim: true,
  wineEstateProductionContinuous: true,
  productionFacts: 'Estate bottled. One hundred percent estate grapes; crush, fermentation, finishing, aging, processing, and bottling remained on the estate premises.',
}

const IMPORTED_WINE_APPLICATION: ApplicationData = {
  ...DOMESTIC_WINE_APPLICATION,
  source: 'imported',
  brandName: 'MONTCLAIRE',
  classType: 'RED WINE',
  alcoholContent: '13% Alc. by Vol.',
  netContents: '750 mL',
  applicantName: 'ATLANTIC CELLARS IMPORTS',
  applicantAddress: 'NEWARK, NEW JERSEY',
  permitName: 'ATLANTIC CELLARS IMPORTS',
  permitAddress: 'NEWARK, NEW JERSEY',
  importCountryOfOrigin: 'FRANCE',
  importBottlingDisposition: 'Bottled in country of origin',
  wineAppellation: 'BORDEAUX',
  wineAppellationType: 'foreign_viticultural_area',
  wineAppellationPercentage: 88,
  wineFinishedInRequiredArea: undefined,
  wineVarietals: [],
  wineVintage: '2022',
  wineVintagePercentage: 96,
  wineForeignLawCompliant: true,
  productionFacts: 'Bordeaux origin and 2022 vintage eligibility verified under French requirements.',
}

const FORMULA_WINE_APPLICATION: ApplicationData = {
  ...DOMESTIC_WINE_APPLICATION,
  brandName: 'ORCHARD BLOOM',
  classType: 'WINE SPECIALTY',
  alcoholContent: '11% Alc. by Vol.',
  formulaRequired: true,
  formulaId: 'W-2026-1407',
  formulaClassType: 'WINE SPECIALTY',
  formulaCompositionStatement: 'APPLE WINE WITH NATURAL CHERRY FLAVOR',
  formulaLabelingInstructions: 'APPLE WINE WITH NATURAL CHERRY FLAVOR|CONTAINS FD&C YELLOW NO. 5|CONTAINS SULFITES|CONTAINS CARMINE',
  applicantName: 'ORCHARD BLOOM WINERY',
  applicantAddress: 'ITHACA, NEW YORK',
  permitName: 'ORCHARD BLOOM WINERY',
  permitAddress: 'ITHACA, NEW YORK',
  containsYellow5: true,
  containsCochinealOrCarmine: true,
  sulfitesPpm: 22,
  wineAppellation: '',
  wineAppellationType: undefined,
  wineAppellationPercentage: undefined,
  wineVarietals: [],
  wineVintage: '',
  wineVintagePercentage: undefined,
  productionFacts: 'Approved specialty-wine formula uses carmine and the stated natural cherry flavor composition.',
}

const UNDER_SEVEN_WINE_APPLICATION: ApplicationData = {
  ...DOMESTIC_WINE_APPLICATION,
  brandName: 'LIGHTHOUSE CIDER',
  classType: 'APPLE WINE',
  alcoholContent: '6.5% Alc. by Vol.',
  netContents: '355 mL',
  containerVolumeMl: 355,
  applicantName: 'LIGHTHOUSE CIDER HOUSE',
  applicantAddress: 'PORTLAND, MAINE',
  permitName: 'LIGHTHOUSE CIDER HOUSE',
  permitAddress: 'PORTLAND, MAINE',
  sulfitesPpm: 0,
  wineAppellation: undefined,
  wineAppellationType: undefined,
  wineAppellationPercentage: undefined,
  wineVarietals: undefined,
  wineVintage: undefined,
  wineVintagePercentage: undefined,
  productionFacts: 'Domestic still apple wine bottled at the qualified wine premises.',
}

export const SAMPLE_LABELS: SampleLabel[] = [
  {
    id: 'valid',
    name: 'Compliant example',
    description: 'Clean studio artwork with expected application values and warning wording.',
    application: INITIAL_APPLICATION,
  },
  {
    id: 'wrong-abv',
    name: 'ABV mismatch',
    description: 'The label says 42% ABV while the application says 45%.',
    application: INITIAL_APPLICATION,
  },
  {
    id: 'warning-case',
    name: 'Warning capitalization',
    description: 'The warning heading uses title case instead of required uppercase.',
    application: INITIAL_APPLICATION,
  },
  {
    id: 'warning-bold',
    name: 'Bold warning body',
    description: 'The first warning sentence is improperly bold after the required heading.',
    application: INITIAL_APPLICATION,
  },
  {
    id: 'missing-warning',
    name: 'Missing warning',
    description: 'The required government warning is absent.',
    application: INITIAL_APPLICATION,
  },
  {
    id: 'angled-photo',
    name: 'Angled tabletop photo',
    description: 'A landscape rye label photographed at an angle against a wood surface.',
    application: EMBER_APPLICATION,
  },
  {
    id: 'glare-photo',
    name: 'Glare and low contrast',
    description: 'A square gin label with diagonal light glare and reduced contrast.',
    application: HARBOR_APPLICATION,
  },
  {
    id: 'dark-label',
    name: 'Reverse dark label',
    description: 'A dark, wide back label with light type and a different visual hierarchy.',
    application: ORCHARD_APPLICATION,
  },
  {
    id: 'upside-down',
    name: 'Upside-down photo',
    description: 'A complete label rotated 180 degrees to verify orientation recovery.',
    application: INITIAL_APPLICATION,
  },
  {
    id: 'imported-clear',
    name: 'Imported spirits — complete',
    description: 'Clear imported whisky with matching importer, country of origin, and age evidence.',
    application: IMPORTED_APPLICATION,
  },
  {
    id: 'imported-origin-mismatch',
    name: 'Imported origin conflict',
    description: 'The packet says Scotland while the readable label says Product of Ireland.',
    application: IMPORTED_APPLICATION,
  },
  {
    id: 'imported-age-understatement',
    name: 'Imported age — allowed understatement',
    description: 'The youngest whisky is documented at eight years and the label permissibly states seven years.',
    application: IMPORTED_APPLICATION,
  },
  {
    id: 'imported-age-overstatement',
    name: 'Imported age — prohibited overstatement',
    description: 'The youngest whisky is documented at eight years while the readable label improperly states nine years.',
    application: IMPORTED_APPLICATION,
  },
  {
    id: 'conditional-disclosures',
    name: 'Formula disclosures — complete',
    description: 'A specialty liqueur with formula wording, Yellow No. 5, sulfites, and aspartame declarations.',
    application: CONDITIONAL_APPLICATION,
  },
  {
    id: 'conditional-missing',
    name: 'Formula disclosures — missing',
    description: 'The same formula packet with required conditional declarations omitted from the artwork.',
    application: CONDITIONAL_APPLICATION,
  },
  {
    id: 'formula-composition-conflict',
    name: 'Formula composition conflict',
    description: 'The formula requires natural flavors while the readable statement of composition says artificial flavors.',
    application: CONDITIONAL_APPLICATION,
  },
  {
    id: 'blur-photo',
    name: 'Motion blur photograph',
    description: 'A domestic rye label softened by camera motion to test evidence uncertainty.',
    application: EMBER_APPLICATION,
  },
  {
    id: 'partial-obstruction',
    name: 'Partially obstructed import label',
    description: 'A foreground obstruction covers part of the imported-product evidence.',
    application: IMPORTED_APPLICATION,
  },
  {
    id: 'missing-context',
    name: 'Incomplete review packet',
    description: 'Readable artwork paired with intentionally missing permit, formula, production, and layout context.',
    application: MISSING_CONTEXT_APPLICATION,
  },
  {
    id: 'routing-override',
    name: 'Incorrect automatic rule set',
    description: 'An imported label is intentionally marked domestic so staff can test the rule-set override safeguard.',
    application: ROUTING_OVERRIDE_APPLICATION,
  },
  {
    id: 'production-disclosures',
    name: 'Production disclosures — complete',
    description: 'Formula-backed neutral spirits, wood treatment, State of distillation, and carmine statements.',
    application: PRODUCTION_DISCLOSURE_APPLICATION,
  },
  {
    id: 'significant-solids',
    name: 'Significant solids alcohol statement',
    description: 'A cherry liqueur using the special bottling-strength wording required for substantial solids.',
    application: SIGNIFICANT_SOLIDS_APPLICATION,
  },
  {
    id: 'exemption-distinctive',
    name: 'Intrastate exemption and bottle evidence',
    description: 'A domestic exemption label with its State limitation and a complete distinctive-bottle packet.',
    application: EXEMPTION_DISTINCTIVE_APPLICATION,
  },
  {
    id: 'wine-domestic-complete',
    name: 'Domestic wine — varietal and vintage',
    description: 'A clear Napa Valley Cabernet with supported varietal, vintage, appellation, and sulfite statements.',
    application: DOMESTIC_WINE_APPLICATION,
  },
  {
    id: 'wine-varietal-support-conflict',
    name: 'Wine varietal support conflict',
    description: 'The label says Cabernet Sauvignon while production records support only 60 percent of that variety.',
    application: WINE_VARIETAL_CONFLICT_APPLICATION,
  },
  {
    id: 'wine-estate-complete',
    name: 'Estate-bottled wine — complete',
    description: 'A Sonoma Valley Chardonnay with complete estate-origin and continuous-production support.',
    application: ESTATE_WINE_APPLICATION,
  },
  {
    id: 'wine-imported-complete',
    name: 'Imported wine — complete',
    description: 'A French wine with matching importer, origin, Bordeaux appellation, and vintage evidence.',
    application: IMPORTED_WINE_APPLICATION,
  },
  {
    id: 'wine-imported-origin-conflict',
    name: 'Imported wine origin conflict',
    description: 'The application says France while the readable artwork says Product of Italy.',
    application: IMPORTED_WINE_APPLICATION,
  },
  {
    id: 'wine-formula-complete',
    name: 'Formula wine disclosures — complete',
    description: 'A specialty apple wine with formula composition, Yellow No. 5, sulfites, and carmine declarations.',
    application: FORMULA_WINE_APPLICATION,
  },
  {
    id: 'wine-formula-missing',
    name: 'Formula wine disclosures — missing',
    description: 'The same formula packet with required composition and additive statements missing from the artwork.',
    application: FORMULA_WINE_APPLICATION,
  },
  {
    id: 'wine-formula-conflict',
    name: 'Formula wine composition conflict',
    description: 'The formula requires natural cherry flavor while the readable composition says artificial cherry flavor.',
    application: FORMULA_WINE_APPLICATION,
  },
  {
    id: 'wine-under-seven-complete',
    name: 'Wine below 7% — TTB checks complete',
    description: 'Domestic cider routed outside Part 4 while retaining applicable TTB Parts 16 and 24 checks.',
    application: UNDER_SEVEN_WINE_APPLICATION,
  },
  {
    id: 'wine-under-seven-missing',
    name: 'Wine below 7% — missing Part 24 information',
    description: 'A below-7% domestic wine missing its kind-of-wine and premises statements.',
    application: UNDER_SEVEN_WINE_APPLICATION,
  },
  {
    id: 'wine-glare-photo',
    name: 'Wine with glare and low contrast',
    description: 'The supported domestic varietal wine photographed with glare across conditional evidence.',
    application: DOMESTIC_WINE_APPLICATION,
  },
]

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function warningMarkup(
  variant: SampleVariant,
  options: { x: number; y: number; size: number; lineHeight: number; color?: string },
) {
  const { x, y, size, lineHeight, color = '#111' } = options
  if (variant === 'missing-warning') {
    return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}">PLEASE ENJOY RESPONSIBLY.</text>`
  }

  const heading = variant === 'warning-case' ? 'Government Warning:' : 'GOVERNMENT WARNING:'
  const bodyWeight = variant === 'warning-bold' ? '700' : '400'
  const lines = [
    'drink alcoholic beverages during pregnancy because of the risk of birth defects.',
    '(2) Consumption of alcoholic beverages impairs your ability to drive a car or',
    'operate machinery, and may cause health problems.',
  ]
  return [
    `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}"><tspan font-weight="700">${escapeXml(heading)}</tspan><tspan font-weight="${bodyWeight}"> (1) According to the Surgeon General, women should not</tspan></text>`,
    ...lines.map(
      (line, index) =>
        `<text x="${x}" y="${y + (index + 1) * lineHeight}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}">${escapeXml(line)}</text>`,
    ),
  ].join('')
}

function classicLabel(variant: SampleVariant) {
  const alcohol = variant === 'wrong-abv' ? '42% Alc./Vol. (84 Proof)' : '45% Alc./Vol. (90 Proof)'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1900" viewBox="0 0 1400 1900">
    <rect width="1400" height="1900" fill="#f4ecd9"/>
    <rect x="36" y="36" width="1328" height="1828" rx="20" fill="none" stroke="#273b2b" stroke-width="8"/>
    <rect x="58" y="58" width="1284" height="1784" rx="14" fill="none" stroke="#b08a45" stroke-width="3"/>
    <text x="700" y="205" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" letter-spacing="9" fill="#7a5b2b">SMALL BATCH</text>
    <path d="M260 260 H1140" stroke="#b08a45" stroke-width="4"/>
    <text x="700" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="132" font-weight="700" fill="#1e3426">OLD TOM</text>
    <text x="700" y="600" text-anchor="middle" font-family="Georgia, serif" font-size="96" letter-spacing="7" fill="#1e3426">DISTILLERY</text>
    <text x="700" y="745" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" letter-spacing="3">KENTUCKY STRAIGHT</text>
    <text x="700" y="810" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700">BOURBON WHISKEY</text>
    <text x="700" y="1060" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" letter-spacing="2" fill="#1e3426">AGED 4 YEARS</text>
    <text x="115" y="1310" font-family="Arial, sans-serif" font-size="38" font-weight="700">${alcohol}</text>
    <text x="1285" y="1310" text-anchor="end" font-family="Arial, sans-serif" font-size="38" font-weight="700">750 mL</text>
    <path d="M90 1380 H1310" stroke="#273b2b" stroke-width="3"/>
    <rect x="75" y="1435" width="1250" height="255" rx="8" fill="#fffdf8" stroke="#273b2b" stroke-width="3"/>
    ${warningMarkup(variant, { x: 90, y: 1505, size: 26, lineHeight: 40 })}
    <text x="700" y="1785" text-anchor="middle" font-family="Arial, sans-serif" font-size="26">BOTTLED BY OLD TOM DISTILLERY, FRANKFORT, KENTUCKY</text>
  </svg>`
}

function emberLabel() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1700" height="1100" viewBox="0 0 1700 1100">
    <defs><linearGradient id="ember" x1="0" x2="1"><stop stop-color="#1b1715"/><stop offset="1" stop-color="#503022"/></linearGradient></defs>
    <rect width="1700" height="1100" rx="30" fill="url(#ember)"/>
    <rect x="30" y="30" width="1640" height="1040" rx="22" fill="none" stroke="#d88b46" stroke-width="6"/>
    <text x="110" y="190" font-family="Georgia, serif" font-size="112" font-weight="700" fill="#f4d5ac">EMBER &amp; ASH</text>
    <text x="115" y="270" font-family="Arial, sans-serif" font-size="42" letter-spacing="7" fill="#e5b87c">STRAIGHT RYE WHISKEY</text>
    <path d="M115 330 H1585" stroke="#d88b46" stroke-width="3"/>
    <text x="115" y="430" font-family="Arial, sans-serif" font-size="43" font-weight="700" fill="#fff4df">50% Alc./Vol. (100 Proof)</text>
    <text x="1585" y="430" text-anchor="end" font-family="Arial, sans-serif" font-size="43" font-weight="700" fill="#fff4df">750 mL</text>
    <rect x="90" y="505" width="1520" height="335" rx="10" fill="#f8f0e4"/>
    ${warningMarkup('angled-photo', { x: 115, y: 590, size: 29, lineHeight: 52 })}
    <text x="115" y="970" font-family="Arial, sans-serif" font-size="29" fill="#e9c497">DISTILLED AND BOTTLED BY EMBER &amp; ASH DISTILLING, LOUISVILLE, KENTUCKY</text>
  </svg>`
}

function harborLabel() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1300" viewBox="0 0 1300 1300">
    <rect width="1300" height="1300" rx="52" fill="#dcece8"/>
    <circle cx="650" cy="365" r="250" fill="#1a5d64"/>
    <path d="M420 390 Q650 235 880 390 Q650 545 420 390" fill="none" stroke="#f7d992" stroke-width="14"/>
    <text x="650" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="78" font-weight="700" fill="#fff">HARBOR</text>
    <text x="650" y="385" text-anchor="middle" font-family="Arial, sans-serif" font-size="108" font-weight="700" fill="#fff">LIGHT</text>
    <text x="650" y="690" text-anchor="middle" font-family="Arial, sans-serif" font-size="50" letter-spacing="8" fill="#184e54">AMERICAN DRY GIN</text>
    <text x="100" y="795" font-family="Arial, sans-serif" font-size="39" font-weight="700">42% Alc./Vol. (84 Proof)</text>
    <text x="1200" y="795" text-anchor="end" font-family="Arial, sans-serif" font-size="39" font-weight="700">1 L</text>
    <rect x="70" y="845" width="1160" height="325" rx="12" fill="#fff" stroke="#184e54" stroke-width="4"/>
    ${warningMarkup('glare-photo', { x: 90, y: 920, size: 24, lineHeight: 44 })}
    <text x="650" y="1235" text-anchor="middle" font-family="Arial, sans-serif" font-size="23">BOTTLED BY HARBOR LIGHT SPIRITS, PORTLAND, MAINE</text>
  </svg>`
}

function orchardLabel() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1050" viewBox="0 0 1800 1050">
    <rect width="1800" height="1050" fill="#121923"/>
    <rect x="28" y="28" width="1744" height="994" fill="none" stroke="#9fb096" stroke-width="3"/>
    <text x="95" y="145" font-family="Georgia, serif" font-size="90" font-weight="700" fill="#f2e7d2">NIGHT ORCHARD</text>
    <text x="100" y="220" font-family="Arial, sans-serif" font-size="42" letter-spacing="10" fill="#a9bd9d">APPLE BRANDY</text>
    <text x="100" y="330" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#f2e7d2">40% Alc./Vol. (80 Proof)</text>
    <text x="1670" y="330" text-anchor="end" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#f2e7d2">375 mL</text>
    <path d="M95 390 H1705" stroke="#9fb096" stroke-width="2"/>
    ${warningMarkup('dark-label', { x: 100, y: 500, size: 29, lineHeight: 54, color: '#f5f1e9' })}
    <text x="100" y="930" font-family="Arial, sans-serif" font-size="28" fill="#a9bd9d">PRODUCED AND BOTTLED BY NIGHT ORCHARD SPIRITS, HUDSON, NEW YORK</text>
  </svg>`
}

function expandedRuleLabel(variant: SampleVariant) {
  const imported = ['imported-clear', 'imported-origin-mismatch', 'imported-age-understatement', 'imported-age-overstatement', 'partial-obstruction', 'routing-override'].includes(variant)
  const conditional = ['conditional-disclosures', 'conditional-missing', 'formula-composition-conflict'].includes(variant)
  const missingContext = variant === 'missing-context'
  const brand = conditional ? 'CITRUS FORGE' : missingContext ? 'PACKET GAP' : imported ? (variant === 'routing-override' ? 'ROUTING CHECK' : 'NORTH SEA RESERVE') : 'EMBER & ASH'
  const classType = conditional ? 'DISTILLED SPIRITS SPECIALTY' : missingContext ? 'VODKA' : imported ? 'SINGLE MALT SCOTCH WHISKY' : 'STRAIGHT RYE WHISKEY'
  const alcohol = conditional ? '30% Alc./Vol. (60 Proof)' : missingContext ? '40% Alc./Vol. (80 Proof)' : imported ? '46% Alc./Vol. (92 Proof)' : '50% Alc./Vol. (100 Proof)'
  const volume = imported ? '700 mL' : '750 mL'
  const origin = variant === 'imported-origin-mismatch' ? 'PRODUCT OF IRELAND' : 'PRODUCT OF SCOTLAND'
  const age = variant === 'imported-age-understatement'
    ? 'AGED 7 YEARS'
    : variant === 'imported-age-overstatement'
      ? 'AGED 9 YEARS'
      : 'AGED 8 YEARS'
  const responsibility = imported
    ? 'IMPORTED BY ATLANTIC IMPORTS LLC, BALTIMORE, MARYLAND'
    : conditional
      ? 'BOTTLED BY CITRUS FORGE SPIRITS, TAMPA, FLORIDA'
      : missingContext
        ? 'BOTTLED BY PACKET GAP SPIRITS, DENVER, COLORADO'
        : 'DISTILLED AND BOTTLED BY EMBER & ASH DISTILLING, LOUISVILLE, KENTUCKY'
  const composition = variant === 'formula-composition-conflict'
    ? 'ORANGE LIQUEUR WITH ARTIFICIAL FLAVORS'
    : 'ORANGE LIQUEUR WITH NATURAL FLAVORS'
  const conditionalStatements = conditional && variant !== 'conditional-missing'
    ? `<text x="90" y="880" font-family="Arial, sans-serif" font-size="27" font-weight="700">GOLDEN CITRUS</text>
       <text x="90" y="925" font-family="Arial, sans-serif" font-size="25">${composition}</text>
       <text x="90" y="970" font-family="Arial, sans-serif" font-size="23">CONTAINS FD&amp;C YELLOW NO. 5 · CONTAINS SULFITES</text>
       <text x="90" y="1015" font-family="Arial, sans-serif" font-size="22" font-weight="700">PHENYLKETONURICS: CONTAINS PHENYLALANINE</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1800" viewBox="0 0 1500 1800">
    <defs><linearGradient id="rule-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${conditional ? '#f5d875' : imported ? '#d9e4e2' : '#eadbc4'}"/><stop offset="1" stop-color="${conditional ? '#e49b40' : imported ? '#9cbab7' : '#b88660'}"/></linearGradient></defs>
    <rect width="1500" height="1800" fill="url(#rule-bg)"/>
    <rect x="45" y="45" width="1410" height="1710" rx="24" fill="rgba(255,255,255,.72)" stroke="#173d31" stroke-width="7"/>
    <text x="750" y="205" text-anchor="middle" font-family="Georgia, serif" font-size="96" font-weight="700" fill="#173d31">${escapeXml(brand)}</text>
    <text x="750" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="43" letter-spacing="4">${escapeXml(classType)}</text>
    <path d="M100 355 H1400" stroke="#8b642b" stroke-width="4"/>
    <text x="105" y="455" font-family="Arial, sans-serif" font-size="39" font-weight="700">${alcohol}</text>
    <text x="1395" y="455" text-anchor="end" font-family="Arial, sans-serif" font-size="39" font-weight="700">${volume}</text>
    ${imported ? `<text x="105" y="545" font-family="Arial, sans-serif" font-size="34" font-weight="700">${age}</text><text x="1395" y="545" text-anchor="end" font-family="Arial, sans-serif" font-size="34" font-weight="700">${origin}</text>` : ''}
    ${conditionalStatements}
    <rect x="75" y="1115" width="1350" height="350" rx="10" fill="#fffdf8" stroke="#173d31" stroke-width="3"/>
    ${warningMarkup(variant, { x: 95, y: 1200, size: 27, lineHeight: 50 })}
    <text x="750" y="1570" text-anchor="middle" font-family="Arial, sans-serif" font-size="27">${escapeXml(responsibility)}</text>
  </svg>`
}

function additionalConditionalLabel(variant: SampleVariant) {
  const production = variant === 'production-disclosures'
  const solids = variant === 'significant-solids'
  const brand = production ? 'WOODLAND PROOF' : solids ? 'ORCHARD ORBIT' : 'COMMONWEALTH'
  const classType = production ? 'AMERICAN WHISKEY SPECIALTY' : solids ? 'CHERRY LIQUEUR' : 'VODKA'
  const alcohol = production ? '40% Alc./Vol. (80 Proof)' : solids ? 'BOTTLED AT 24 PERCENT ALCOHOL BY VOLUME' : '40% Alc./Vol. (80 Proof)'
  const responsibility = production
    ? 'BOTTLED BY WOODLAND PROOF DISTILLING, LEXINGTON, KENTUCKY'
    : solids
      ? 'BOTTLED BY ORCHARD ORBIT SPIRITS, TRAVERSE CITY, MICHIGAN'
      : 'BOTTLED BY COMMONWEALTH SPIRITS, RICHMOND, VIRGINIA'
  const disclosures = production
    ? [
        'AMERICAN WHISKEY WITH NATURAL FLAVORS',
        '50% NEUTRAL SPIRITS DISTILLED FROM CORN',
        'COLORED AND FLAVORED WITH OAK CHIPS',
        'DISTILLED IN KENTUCKY · CONTAINS CARMINE',
      ]
    : solids
      ? ['CHERRY LIQUEUR WITH WHOLE CHERRIES', 'WHOLE CHERRIES IN CONTAINER']
      : ['FOR SALE IN VIRGINIA ONLY', 'DISTINCTIVE BOTTLE APPLICATION NO. 9']
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1800" viewBox="0 0 1500 1800">
    <rect width="1500" height="1800" fill="${production ? '#d8c7a4' : solids ? '#ead7dc' : '#dce5ef'}"/>
    <path d="M0 300 Q500 40 1000 260 T1500 180 V0 H0Z" fill="${production ? '#33543e' : solids ? '#7b243d' : '#263f64'}" opacity=".96"/>
    <rect x="48" y="48" width="1404" height="1704" rx="28" fill="none" stroke="#172f28" stroke-width="7"/>
    <text x="750" y="230" text-anchor="middle" font-family="Georgia, serif" font-size="96" font-weight="700" fill="#fff">${escapeXml(brand)}</text>
    <text x="750" y="365" text-anchor="middle" font-family="Arial, sans-serif" font-size="43" letter-spacing="4">${escapeXml(classType)}</text>
    <text x="95" y="465" font-family="Arial, sans-serif" font-size="37" font-weight="700">${alcohol}</text>
    <text x="1405" y="465" text-anchor="end" font-family="Arial, sans-serif" font-size="37" font-weight="700">750 mL</text>
    ${disclosures.map((line, index) => `<text x="95" y="${585 + index * 62}" font-family="Arial, sans-serif" font-size="${index === 0 ? 31 : 27}" font-weight="${index === 0 ? 700 : 400}">${escapeXml(line)}</text>`).join('')}
    <rect x="72" y="1055" width="1356" height="380" rx="12" fill="#fffdf8" stroke="#172f28" stroke-width="3"/>
    ${warningMarkup(variant, { x: 95, y: 1145, size: 27, lineHeight: 52 })}
    <text x="750" y="1560" text-anchor="middle" font-family="Arial, sans-serif" font-size="26">${escapeXml(responsibility)}</text>
  </svg>`
}

function wineLabel(variant: SampleVariant) {
  const estate = variant === 'wine-estate-complete'
  const imported = variant === 'wine-imported-complete' || variant === 'wine-imported-origin-conflict'
  const formula = variant === 'wine-formula-complete' || variant === 'wine-formula-missing' || variant === 'wine-formula-conflict'
  const underSeven = variant === 'wine-under-seven-complete' || variant === 'wine-under-seven-missing'
  const missing = variant === 'wine-formula-missing' || variant === 'wine-under-seven-missing'
  const brand = estate ? 'STONE ARBOR' : imported ? 'MONTCLAIRE' : formula ? 'ORCHARD BLOOM' : underSeven ? 'LIGHTHOUSE CIDER' : 'RIDGE & RIVER'
  const classType = estate ? 'CHARDONNAY' : imported ? 'RED WINE' : formula ? 'WINE SPECIALTY' : underSeven ? 'APPLE WINE' : 'CABERNET SAUVIGNON'
  const appellation = estate ? 'SONOMA VALLEY' : imported ? 'BORDEAUX' : 'NAPA VALLEY'
  const alcohol = estate ? '12.8% Alc. by Vol.' : imported ? '13% Alc. by Vol.' : formula ? '11% Alc. by Vol.' : underSeven ? '6.5% Alc. by Vol.' : '13.5% Alc. by Vol.'
  const volume = underSeven ? '355 mL' : '750 mL'
  const responsibility = estate
    ? 'BOTTLED BY STONE ARBOR ESTATE, SONOMA, CALIFORNIA'
    : imported
      ? 'IMPORTED BY ATLANTIC CELLARS IMPORTS, NEWARK, NEW JERSEY'
      : formula
        ? 'BOTTLED BY ORCHARD BLOOM WINERY, ITHACA, NEW YORK'
        : underSeven
          ? 'BOTTLED BY LIGHTHOUSE CIDER HOUSE, PORTLAND, MAINE'
          : 'BOTTLED BY RIDGE & RIVER WINERY, ST. HELENA, CALIFORNIA'
  const origin = variant === 'wine-imported-origin-conflict' ? 'PRODUCT OF ITALY' : 'PRODUCT OF FRANCE'
  const composition = variant === 'wine-formula-conflict'
    ? 'APPLE WINE WITH ARTIFICIAL CHERRY FLAVOR'
    : 'APPLE WINE WITH NATURAL CHERRY FLAVOR'
  const conditional = formula && !missing
    ? [
        composition,
        'CONTAINS FD&C YELLOW NO. 5',
        'CONTAINS SULFITES · CONTAINS CARMINE',
      ]
    : []
  const wineDetails = estate
    ? ['ESTATE BOTTLED', appellation, classType, 'CONTAINS SULFITES']
    : imported
      ? ['2022', appellation, classType, origin, 'CONTAINS SULFITES']
      : formula
        ? [classType, ...conditional]
        : underSeven
          ? missing ? [] : [classType]
          : ['2023', appellation, classType, 'CONTAINS SULFITES']
  const palette = estate
    ? ['#173a2e', '#e8dfc4', '#8e7243']
    : imported
      ? ['#401821', '#f3e7d9', '#b78b58']
      : formula
        ? ['#682744', '#f6ddbd', '#da9147']
        : underSeven
          ? ['#164e5b', '#e4eee8', '#d4aa4d']
          : ['#243c5a', '#f1e6ce', '#9b743d']
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1900" viewBox="0 0 1500 1900">
    <rect width="1500" height="1900" fill="${palette[1]}"/>
    <rect x="38" y="38" width="1424" height="1824" rx="34" fill="none" stroke="${palette[0]}" stroke-width="9"/>
    <path d="M0 0 H1500 V390 Q1120 300 750 410 Q370 520 0 390Z" fill="${palette[0]}"/>
    <circle cx="750" cy="235" r="102" fill="none" stroke="${palette[2]}" stroke-width="8"/>
    <path d="M705 250 Q750 125 795 250 Q750 215 705 250" fill="${palette[2]}"/>
    <text x="750" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="94" font-weight="700" letter-spacing="3" fill="${palette[0]}">${escapeXml(brand)}</text>
    <path d="M215 600 H1285" stroke="${palette[2]}" stroke-width="4"/>
    ${wineDetails.map((line, index) => `<text x="750" y="${700 + index * 72}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${index === 0 ? 43 : 36}" font-weight="${index < 3 ? 700 : 400}" fill="${palette[0]}">${escapeXml(line)}</text>`).join('')}
    <text x="110" y="1100" font-family="Arial, sans-serif" font-size="38" font-weight="700">${alcohol}</text>
    <text x="1390" y="1100" text-anchor="end" font-family="Arial, sans-serif" font-size="38" font-weight="700">${volume}</text>
    <rect x="75" y="1180" width="1350" height="350" rx="12" fill="#fffdf8" stroke="${palette[0]}" stroke-width="3"/>
    ${warningMarkup(variant, { x: 95, y: 1265, size: 27, lineHeight: 50 })}
    ${missing && underSeven ? '' : `<text x="750" y="1650" text-anchor="middle" font-family="Arial, sans-serif" font-size="27">${escapeXml(responsibility)}</text>`}
    <text x="750" y="1740" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${palette[0]}">GROWN WITH CARE · REVIEWED WITH EVIDENCE</text>
  </svg>`
}

function sampleSvg(variant: SampleVariant) {
  if (variant === 'angled-photo') return emberLabel()
  if (variant === 'glare-photo') return harborLabel()
  if (variant === 'dark-label') return orchardLabel()
  if (['production-disclosures', 'significant-solids', 'exemption-distinctive'].includes(variant)) return additionalConditionalLabel(variant)
  if (variant.startsWith('wine-')) return wineLabel(variant)
  if (['imported-clear', 'imported-origin-mismatch', 'imported-age-understatement', 'imported-age-overstatement', 'conditional-disclosures', 'conditional-missing', 'formula-composition-conflict', 'blur-photo', 'partial-obstruction', 'missing-context', 'routing-override'].includes(variant)) return expandedRuleLabel(variant)
  return classicLabel(variant)
}

async function loadSvg(svg: string) {
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(source)
  }
}

export async function createSampleFile(variant: SampleVariant) {
  const image = await loadSvg(sampleSvg(variant))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser could not create the sample image.')

  if (variant === 'angled-photo') {
    canvas.width = 1900
    canvas.height = 1450
    const wood = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    wood.addColorStop(0, '#b88f68')
    wood.addColorStop(1, '#76523a')
    context.fillStyle = wood
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.save()
    context.translate(950, 725)
    context.rotate((-4.5 * Math.PI) / 180)
    context.shadowColor = 'rgba(0, 0, 0, 0.5)'
    context.shadowBlur = 35
    context.shadowOffsetY = 24
    context.drawImage(image, -800, -518, 1600, 1035)
    context.restore()
  } else {
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    if (variant === 'upside-down') {
      context.translate(canvas.width, canvas.height)
      context.rotate(Math.PI)
    }
    if (variant === 'blur-photo') context.filter = 'blur(2.4px) contrast(0.88)'
    context.drawImage(image, 0, 0)
    context.filter = 'none'
    if (variant === 'glare-photo' || variant === 'wine-glare-photo') {
      const glare = context.createLinearGradient(250, 0, 950, 1300)
      glare.addColorStop(0, 'rgba(255,255,255,0)')
      glare.addColorStop(0.42, 'rgba(255,255,255,0.08)')
      glare.addColorStop(0.54, 'rgba(255,255,255,0.72)')
      glare.addColorStop(0.66, 'rgba(255,255,255,0.12)')
      glare.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = glare
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = 'rgba(236, 239, 230, 0.12)'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    if (variant === 'partial-obstruction') {
      context.save()
      context.translate(1150, 505)
      context.rotate(-0.18)
      context.fillStyle = 'rgba(35, 48, 42, 0.94)'
      context.fillRect(-250, -95, 540, 190)
      context.restore()
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Sample image creation failed.'))),
      'image/png',
    ),
  )
  return new File([blob], `${variant}-sample-label.png`, { type: 'image/png' })
}
