import { describe, expect, it } from 'vitest'
import { INITIAL_APPLICATION, applicationSchema, imageFileSchema, validateImageFile } from './reviewSchema'

describe('applicationSchema', () => {
  it('accepts the representative distilled-spirits application', () => {
    expect(applicationSchema.safeParse(INITIAL_APPLICATION).success).toBe(true)
  })

  it('rejects alcohol content without an ABV percentage', () => {
    const result = applicationSchema.safeParse({
      ...INITIAL_APPLICATION,
      alcoholContent: 'Ninety proof',
    })

    expect(result.success).toBe(false)
  })

  it('rejects impossible container volumes', () => {
    const result = applicationSchema.safeParse({
      ...INITIAL_APPLICATION,
      containerVolumeMl: 0,
    })

    expect(result.success).toBe(false)
  })
})

describe('imageFileSchema', () => {
  it('rejects files whose declared type is not a supported image', () => {
    const file = new File(['not an image'], 'label.pdf', { type: 'application/pdf' })
    expect(imageFileSchema.safeParse(file).success).toBe(false)
  })

  it('rejects a renamed non-image using its file signature', async () => {
    const file = new File(['not an image'], 'label.png', { type: 'image/png' })
    expect((await validateImageFile(file)).success).toBe(false)
  })

  it('accepts a file with a PNG signature', async () => {
    const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const file = new File([signature], 'label.png', { type: 'image/png' })
    expect((await validateImageFile(file)).success).toBe(true)
  })
})
