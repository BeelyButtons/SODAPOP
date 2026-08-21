import { describe, expect, it } from 'vitest'
import { shouldRetryRecognition } from './recognizeLabel'

describe('OCR retry quality gate', () => {
  it('stops after a strong high-confidence pass with one obstructed core field', () => {
    expect(shouldRetryRecognition(4, 95)).toBe(false)
  })

  it('retries when the same partial evidence is low confidence', () => {
    expect(shouldRetryRecognition(4, 62)).toBe(true)
  })

  it('retries materially incomplete evidence regardless of overall confidence', () => {
    expect(shouldRetryRecognition(3.2, 95)).toBe(true)
  })
})
