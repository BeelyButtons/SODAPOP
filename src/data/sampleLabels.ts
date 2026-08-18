import { INITIAL_APPLICATION, type ApplicationData } from '../domain/reviewSchema'

type SampleVariant = 'valid' | 'wrong-abv' | 'warning-case' | 'missing-warning'

export type SampleLabel = {
  id: SampleVariant
  name: string
  description: string
  application: ApplicationData
}

export const SAMPLE_LABELS: SampleLabel[] = [
  {
    id: 'valid',
    name: 'Compliant example',
    description: 'Expected application values and exact warning wording.',
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
    id: 'missing-warning',
    name: 'Missing warning',
    description: 'The required government warning is absent.',
    application: INITIAL_APPLICATION,
  },
]

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function warningLines(variant: SampleVariant) {
  if (variant === 'missing-warning') {
    return ['PLEASE ENJOY RESPONSIBLY.']
  }

  const heading = variant === 'warning-case' ? 'Government Warning:' : 'GOVERNMENT WARNING:'
  return [
    `${heading} (1) According to the Surgeon General, women should not`,
    'drink alcoholic beverages during pregnancy because of the risk of birth defects.',
    '(2) Consumption of alcoholic beverages impairs your ability to drive a car or',
    'operate machinery, and may cause health problems.',
  ]
}

function sampleSvg(variant: SampleVariant) {
  const alcohol = variant === 'wrong-abv' ? '42% Alc./Vol. (84 Proof)' : '45% Alc./Vol. (90 Proof)'
  const lines = warningLines(variant)
  const warning = lines
    .map(
      (line, index) =>
        `<text x="90" y="${1505 + index * 40}" font-family="Arial, sans-serif" font-size="26" ${
          index === 0 && variant !== 'missing-warning' ? 'font-weight="700"' : ''
        }>${escapeXml(line)}</text>`,
    )
    .join('')

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
    <circle cx="700" cy="1035" r="125" fill="none" stroke="#b08a45" stroke-width="5"/>
    <text x="700" y="1025" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="#7a5b2b">AGED</text>
    <text x="700" y="1090" text-anchor="middle" font-family="Georgia, serif" font-size="70" font-weight="700" fill="#1e3426">4 YEARS</text>
    <text x="115" y="1310" font-family="Arial, sans-serif" font-size="38" font-weight="700">${alcohol}</text>
    <text x="1285" y="1310" text-anchor="end" font-family="Arial, sans-serif" font-size="38" font-weight="700">750 mL</text>
    <path d="M90 1380 H1310" stroke="#273b2b" stroke-width="3"/>
    <rect x="75" y="1435" width="1250" height="255" rx="8" fill="#fffdf8" stroke="#273b2b" stroke-width="3"/>
    ${warning}
    <text x="700" y="1785" text-anchor="middle" font-family="Arial, sans-serif" font-size="26">BOTTLED BY OLD TOM DISTILLERY, FRANKFORT, KENTUCKY</text>
  </svg>`
}

export async function createSampleFile(variant: SampleVariant) {
  const svg = sampleSvg(variant)
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1400
    canvas.height = 1900
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not create the sample image.')
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Sample image creation failed.'))),
        'image/png',
      ),
    )
    return new File([blob], `${variant}-old-tom-label.png`, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(source)
  }
}
