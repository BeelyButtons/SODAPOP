import { z } from 'zod'

export const GOVERNMENT_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'

export const applicationSchema = z.object({
  productType: z.enum(['distilled_spirits', 'wine', 'malt_beverage']),
  source: z.enum(['domestic', 'imported']),
  brandName: z.string().trim().min(2, 'Enter the brand name.'),
  classType: z.string().trim().min(3, 'Enter the class or type.'),
  alcoholContent: z
    .string()
    .trim()
    .regex(/\d+(?:\.\d+)?\s*%/, 'Include an alcohol percentage, such as 45%.'),
  netContents: z
    .string()
    .trim()
    .regex(/\d+(?:\.\d+)?\s*(?:mL|L|fl\.?\s*oz\.?)/i, 'Include a supported volume and unit.'),
  containerVolumeMl: z.coerce
    .number()
    .positive('Container volume must be greater than zero.')
    .max(100_000, 'Container volume is outside the supported range.'),
  applicationType: z.enum(['cola', 'exemption']).optional(),
  distinctiveBottleRequested: z.boolean().optional(),
  destinationState: z.string().trim().optional(),
  fancifulName: z.string().trim().optional(),
  applicantName: z.string().trim().optional(),
  applicantAddress: z.string().trim().optional(),
  permitName: z.string().trim().optional(),
  permitAddress: z.string().trim().optional(),
  formulaRequired: z.boolean().optional(),
  formulaId: z.string().trim().optional(),
  formulaClassType: z.string().trim().optional(),
  formulaCompositionStatement: z.string().trim().optional(),
  formulaLabelingInstructions: z.string().trim().optional(),
  labelDimensions: z.string().trim().optional(),
  labelSet: z.boolean().optional(),
  bottleMarkings: z.string().trim().optional(),
  bottleDesignEvidence: z.string().trim().optional(),
  containsSignificantSolids: z.boolean().optional(),
  containsNeutralSpirits: z.boolean().optional(),
  requiresAgeStatement: z.boolean().optional(),
  spiritsAgeOrMaturityClaim: z.boolean().optional(),
  requiresWoodTreatmentDisclosure: z.boolean().optional(),
  requiresStateOfDistillation: z.boolean().optional(),
  containsYellow5: z.boolean().optional(),
  containsCochinealOrCarmine: z.boolean().optional(),
  sulfitesPpm: z.number().nonnegative().optional(),
  containsAspartame: z.boolean().optional(),
  importCountryOfOrigin: z.string().trim().optional(),
  importBottlingDisposition: z.string().trim().optional(),
  productionFacts: z.string().trim().optional(),
})

export type ApplicationData = z.infer<typeof applicationSchema>

export const INITIAL_APPLICATION: ApplicationData = {
  productType: 'distilled_spirits',
  source: 'domestic',
  brandName: 'OLD TOM DISTILLERY',
  classType: 'Kentucky Straight Bourbon Whiskey',
  alcoholContent: '45% Alc./Vol. (90 Proof)',
  netContents: '750 mL',
  containerVolumeMl: 750,
  applicationType: 'cola',
  distinctiveBottleRequested: false,
  applicantName: 'OLD TOM DISTILLERY',
  applicantAddress: 'FRANKFORT, KENTUCKY',
  permitName: 'OLD TOM DISTILLERY',
  permitAddress: 'FRANKFORT, KENTUCKY',
  formulaRequired: false,
  formulaId: '',
  formulaClassType: '',
  formulaCompositionStatement: '',
  formulaLabelingInstructions: '',
  fancifulName: '',
  labelDimensions: 'Complete single label face; 4 × 6 inches',
  labelSet: true,
  bottleMarkings: 'None documented',
  containsSignificantSolids: false,
  containsNeutralSpirits: false,
  requiresAgeStatement: false,
  spiritsAgeOrMaturityClaim: true,
  requiresWoodTreatmentDisclosure: false,
  requiresStateOfDistillation: false,
  containsYellow5: false,
  containsCochinealOrCarmine: false,
  sulfitesPpm: 0,
  containsAspartame: false,
  productionFacts: 'Small batch production documented. Youngest applicable spirit aged 4 years.',
}

export type CheckStatus = 'pass' | 'mismatch' | 'needs_review'

export type OcrBox = {
  x0: number
  y0: number
  x1: number
  y1: number
  points?: Array<{ x: number; y: number }>
}

export type OcrWord = {
  text: string
  confidence: number
  bbox: OcrBox
  lineId?: string
  fontName?: string
  inkRatio?: number
}

export type HighlightRegion = {
  boxes: OcrBox[]
  imageWidth: number
  imageHeight: number
}

export type ReviewCheck = {
  id: string
  ruleId?: string
  label: string
  status: CheckStatus
  expected: string
  requirements?: string[]
  requirementsLabel?: string
  observed: string
  explanation: string
  applicabilityExplanation?: string
  applicationEvidence?: string
  labelEvidence?: string
  highlight?: HighlightRegion
}

export type ReviewOutcome = {
  status: CheckStatus
  checks: ReviewCheck[]
  ocrText: string
  ocrConfidence: number
  durationMs: number
  ocrAttempts?: number
  ocrRotationDegrees?: number
  application?: ApplicationData
  ocrWords?: OcrWord[]
  imageWidth?: number
  imageHeight?: number
  ruleSelection?: import('./ruleEngine').RuleSetSelection
}

export const imageFileSchema = z
  .instanceof(File)
  .refine(
    (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    'Upload a JPEG, PNG, or WebP image.',
  )
  .refine((file) => file.size <= 10 * 1024 * 1024, 'The image must be 10 MB or smaller.')

export async function validateImageFile(file: File) {
  const metadataResult = imageFileSchema.safeParse(file)
  if (!metadataResult.success) {
    return { success: false as const, error: metadataResult.error.issues[0]?.message ?? 'Invalid image.' }
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  const isWebP =
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'

  if (!isJpeg && !isPng && !isWebP) {
    return {
      success: false as const,
      error: 'The file contents do not match a supported JPEG, PNG, or WebP image.',
    }
  }

  return { success: true as const, data: file }
}
