import { describe, expect, it } from 'vitest'
import { inspectRasterHeader, sanitizeUploadedLabel, UPLOAD_SAFETY_LIMITS } from './uploadSecurity'

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpegHeader(width: number, height: number) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
  ])
}

describe('applicant upload security', () => {
  it('recognizes genuine PNG and JPEG headers and their dimensions', () => {
    expect(inspectRasterHeader(pngHeader(1200, 1800))).toEqual({ type: 'image/png', width: 1200, height: 1800 })
    expect(inspectRasterHeader(jpegHeader(1400, 900))).toEqual({ type: 'image/jpeg', width: 1400, height: 900 })
  })

  it('rejects a non-image even when its filename and browser type claim it is PNG', async () => {
    const disguised = new File(['%PDF-1.7 definitely not an image'], 'renamed-malware.png', { type: 'image/png' })
    await expect(sanitizeUploadedLabel(disguised)).rejects.toThrow(/Only genuine PNG and JPEG/i)
  })

  it('rejects content whose real image type conflicts with its reported type', async () => {
    const mismatch = new File([pngHeader(1200, 1800)], 'label.jpg', { type: 'image/jpeg' })
    await expect(sanitizeUploadedLabel(mismatch)).rejects.toThrow(/do not match/i)
  })

  it('rejects oversized and dangerously large images before decoding', async () => {
    const oversized = new File([new Uint8Array(UPLOAD_SAFETY_LIMITS.maxBytes + 1)], 'huge.png', { type: 'image/png' })
    await expect(sanitizeUploadedLabel(oversized)).rejects.toThrow(/10 MB limit/i)
    const excessiveDimensions = new File([pngHeader(10_000, 10_000)], 'pixel-bomb.png', { type: 'image/png' })
    await expect(sanitizeUploadedLabel(excessiveDimensions)).rejects.toThrow(/dimensions are too large/i)
  })
})
