const MAX_FILE_BYTES = 10 * 1024 * 1024
const MIN_IMAGE_EDGE = 300
const MAX_IMAGE_EDGE = 10_000
const MAX_IMAGE_PIXELS = 36_000_000
const NORMALIZED_MAX_EDGE = 3000

export type AcceptedRasterType = 'image/png' | 'image/jpeg'

export interface InspectedRaster {
  type: AcceptedRasterType
  width: number
  height: number
}

function isPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return signature.every((value, index) => bytes[index] === value)
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || !isPng(bytes) || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue }
    const marker = bytes[offset + 1]
    offset += 2
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) break
    const segmentLength = view.getUint16(offset)
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)
    if (isStartOfFrame && offset + 7 <= bytes.length) return { height: view.getUint16(offset + 3), width: view.getUint16(offset + 5) }
    if (segmentLength < 2) break
    offset += segmentLength
  }
  return undefined
}

export function inspectRasterHeader(bytes: Uint8Array): InspectedRaster | undefined {
  const png = pngDimensions(bytes)
  if (png) return { type: 'image/png', ...png }
  const jpeg = jpegDimensions(bytes)
  if (jpeg) return { type: 'image/jpeg', ...jpeg }
  return undefined
}

function validateDimensions(width: number, height: number) {
  if (width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE) throw new Error(`The image must be at least ${MIN_IMAGE_EDGE} × ${MIN_IMAGE_EDGE} pixels.`)
  if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE || width * height > MAX_IMAGE_PIXELS) throw new Error('The image dimensions are too large to process safely.')
}

function safeBaseName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return base || 'submitted-label'
}

export async function sanitizeUploadedLabel(file: File) {
  if (!file || file.size === 0) throw new Error('Choose a non-empty label image.')
  if (file.size > MAX_FILE_BYTES) throw new Error('The image is larger than the 10 MB limit.')
  const headerBytes = new Uint8Array(await file.slice(0, Math.min(file.size, 128 * 1024)).arrayBuffer())
  const inspected = inspectRasterHeader(headerBytes)
  if (!inspected) throw new Error('Only genuine PNG and JPEG label images are accepted. Renamed or unsupported files are rejected.')
  if (file.type && file.type !== inspected.type) throw new Error('The file contents do not match the image type reported by the browser.')
  validateDimensions(inspected.width, inspected.height)

  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width !== inspected.width || bitmap.height !== inspected.height) throw new Error('The decoded image dimensions do not match its file header.')
    const scale = Math.min(1, NORMALIZED_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not safely prepare the image.')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The image could not be safely re-encoded.')), 'image/png'))
    return new File([blob], `${safeBaseName(file.name)}-normalized.png`, { type: 'image/png', lastModified: Date.now() })
  } finally { bitmap.close() }
}

export const UPLOAD_SAFETY_LIMITS = { maxBytes: MAX_FILE_BYTES, minEdge: MIN_IMAGE_EDGE, maxEdge: MAX_IMAGE_EDGE, maxPixels: MAX_IMAGE_PIXELS }
