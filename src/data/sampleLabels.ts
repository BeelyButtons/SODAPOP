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
}

const HARBOR_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'HARBOR LIGHT',
  classType: 'AMERICAN DRY GIN',
  alcoholContent: '42% Alc./Vol. (84 Proof)',
  netContents: '1 L',
  containerVolumeMl: 1_000,
}

const ORCHARD_APPLICATION: ApplicationData = {
  ...INITIAL_APPLICATION,
  brandName: 'NIGHT ORCHARD',
  classType: 'APPLE BRANDY',
  alcoholContent: '40% Alc./Vol. (80 Proof)',
  netContents: '375 mL',
  containerVolumeMl: 375,
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
    <circle cx="700" cy="1035" r="125" fill="none" stroke="#b08a45" stroke-width="5"/>
    <text x="700" y="1025" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="#7a5b2b">AGED</text>
    <text x="700" y="1090" text-anchor="middle" font-family="Georgia, serif" font-size="70" font-weight="700" fill="#1e3426">4 YEARS</text>
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
    <text x="115" y="970" font-family="Arial, sans-serif" font-size="29" fill="#e9c497">DISTILLED AND BOTTLED IN LOUISVILLE, KENTUCKY</text>
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

function sampleSvg(variant: SampleVariant) {
  if (variant === 'angled-photo') return emberLabel()
  if (variant === 'glare-photo') return harborLabel()
  if (variant === 'dark-label') return orchardLabel()
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
    context.drawImage(image, 0, 0)
    if (variant === 'glare-photo') {
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
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Sample image creation failed.'))),
      'image/png',
    ),
  )
  return new File([blob], `${variant}-sample-label.png`, { type: 'image/png' })
}
