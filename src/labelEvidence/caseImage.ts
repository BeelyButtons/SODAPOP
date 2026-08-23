import { GOVERNMENT_WARNING, type ApplicationData } from '../domain/reviewSchema'
import { parseVolume } from '../domain/normalization'
import type { LabelEvidenceCase } from './types'

function escapeXml(value: string | undefined) {
  return (value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function splitResponsibleParty(value: string) {
  const withoutOperation = value.replace(/^(?:bottled|produced(?: and bottled)?|brewed(?: and bottled)?|imported) by\s+/i, '')
  const parts = withoutOperation.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length >= 3
    ? { name: parts.slice(0, -2).join(', '), address: parts.slice(-2).join(', ') }
    : { name: withoutOperation, address: '' }
}

export function applicationDataForCase(item: LabelEvidenceCase): ApplicationData {
  const party = splitResponsibleParty(item.application.responsibleParty)
  return {
    productType: item.application.commodity,
    source: item.application.source,
    brandName: item.application.brandName,
    classType: item.application.classType,
    alcoholContent: item.application.alcoholContent,
    netContents: item.application.netContents,
    containerVolumeMl: parseVolume(item.application.netContents) ?? 750,
    applicationType: 'cola',
    distinctiveBottleRequested: false,
    applicantName: party.name,
    applicantAddress: party.address,
    permitName: party.name,
    permitAddress: party.address,
    formulaRequired: item.application.formula.required,
    formulaId: item.application.formula.id ?? '',
    formulaClassType: item.application.formula.required ? item.application.classType : '',
    formulaCompositionStatement: item.application.formula.labelingInstructions ?? '',
    formulaLabelingInstructions: item.application.formula.labelingInstructions ?? '',
    fancifulName: '',
    labelDimensions: 'Complete single brand label face; 4 x 6 inches',
    labelSet: true,
    bottleMarkings: 'None documented',
    labelAlcoholStatementPresent: true,
    containsSignificantSolids: false,
    containsNeutralSpirits: false,
    requiresAgeStatement: Boolean(item.application.ageYears),
    spiritsAgeOrMaturityClaim: Boolean(item.application.ageYears),
    requiresWoodTreatmentDisclosure: false,
    requiresStateOfDistillation: false,
    containsYellow5: false,
    containsCochinealOrCarmine: false,
    sulfitesPpm: item.application.sulfitesPpm,
    containsAspartame: false,
    wineAppellation: '',
    wineVarietals: [],
    wineVintage: '',
    wineEstateBottledClaim: false,
    wineEstateProductionContinuous: false,
    wineFinishedInRequiredArea: false,
    wineForeignLawCompliant: item.application.source === 'imported',
    wineForeignBlendReferenced: false,
    maltAlcoholFromAddedIngredients: false,
    maltAlcoholCharacterizationClaim: false,
    maltGeographicClaim: false,
    maltSpecialtyProduct: item.application.formula.required,
    maltPostImportBottling: false,
    importCountryOfOrigin: item.application.countryOrigin,
    importBottlingDisposition: item.application.source === 'imported' ? 'Imported in the labeled container' : undefined,
    productionFacts: [
      `Ingredients: ${item.application.ingredients.join(', ')}`,
      item.application.formula.labelingInstructions,
      ...item.evidence.filter((record) => record.status === 'available').map((record) => `${record.title}: ${record.supports.join(', ')}`),
    ].filter(Boolean).join('; '),
  }
}

function warningLines(text: string) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (`${current} ${word}`.trim().length > 64) { lines.push(current); current = word } else current = `${current} ${word}`.trim()
  }
  if (current) lines.push(current)
  return lines
}

function labelSvg(item: LabelEvidenceCase) {
  const label = item.label
  const heading = label.warning.headingCapitalized ? 'GOVERNMENT WARNING:' : 'Government Warning:'
  const warning = label.warning.exactText ? GOVERNMENT_WARNING.replace(/^GOVERNMENT WARNING:\s*/, '') : GOVERNMENT_WARNING.replace(/^GOVERNMENT WARNING:\s*/, '').replace('may cause health problems', 'can cause health problems')
  const warningMarkup = label.warning.present ? `<text x="105" y="1175" font-family="Arial, sans-serif" font-size="32" ${label.warning.headingBold ? 'font-weight="800"' : ''}>${heading}</text>${warningLines(warning).map((line, index) => `<text x="105" y="${1230 + index * 43}" font-family="Arial, sans-serif" font-size="32">${escapeXml(line)}</text>`).join('')}` : ''
  const claimMarkup = label.claims.map((claim, index) => `<text x="600" y="${485 + index * 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#8f382f">${escapeXml(claim.text)}</text>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1700" viewBox="0 0 1200 1700"><rect width="1200" height="1700" fill="#f6f0df"/><rect x="45" y="45" width="1110" height="1610" fill="none" stroke="#173b36" stroke-width="14"/><text x="600" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700">${escapeXml(item.application.commodity.replace('_', ' ').toUpperCase())}</text><text x="600" y="315" text-anchor="middle" font-family="Georgia, serif" font-size="72" font-weight="700">${escapeXml(label.brandName)}</text><text x="600" y="400" text-anchor="middle" font-family="Georgia, serif" font-size="38" font-weight="700">${escapeXml(label.classType)}</text>${claimMarkup}<text x="310" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(label.alcoholContent)}</text><text x="860" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(label.netContents)}</text><text x="600" y="770" text-anchor="middle" font-family="Arial, sans-serif" font-size="25">${escapeXml(label.responsibleParty)}</text>${label.countryOrigin ? `<text x="600" y="825" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" font-weight="700">PRODUCT OF ${escapeXml(label.countryOrigin.toUpperCase())}</text>` : ''}${label.declarations.map((value, index) => `<text x="600" y="${885 + index * 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700">${escapeXml(value.toUpperCase())}</text>`).join('')}<line x1="90" y1="1090" x2="1110" y2="1090" stroke="#173b36" stroke-width="4"/>${warningMarkup}</svg>`
}

export async function createCaseImageFile(item: LabelEvidenceCase) {
  const source = URL.createObjectURL(new Blob([labelSvg(item)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not create the label image.')
    if (item.label.imageQuality === 'limited') context.filter = 'blur(3px) contrast(.72) brightness(.92)'
    context.drawImage(image, 0, 0)
    context.filter = 'none'
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Label image creation failed.')), 'image/png'))
    return new File([blob], `${item.id}.png`, { type: 'image/png' })
  } finally { URL.revokeObjectURL(source) }
}
