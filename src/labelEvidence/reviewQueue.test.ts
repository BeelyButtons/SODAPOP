import { describe, expect, it } from 'vitest'
import { createRandomizedReviewQueue, createReviewQueue, randomizeCaseOrder } from './reviewQueue'

const ids = Array.from({ length: 56 }, (_, index) => `LE-${String(index + 1).padStart(3, '0')}`)

describe('FIFO review queue', () => {
  it('starts with two singles and a five-label batch', () => {
    const queue = createReviewQueue(ids, 20260822)
    expect(queue[0]).toMatchObject({ kind: 'single', caseIds: ['LE-001'] })
    expect(queue[1]).toMatchObject({ kind: 'single', caseIds: ['LE-002'] })
    expect(queue[2]).toMatchObject({ kind: 'batch', caseIds: ['LE-003', 'LE-004', 'LE-005', 'LE-006', 'LE-007'] })
  })

  it('uses only three-to-seven-label batches after the first batch', () => {
    const queue = createReviewQueue(ids, 17)
    expect(queue.filter((unit) => unit.kind === 'batch').slice(1).every((unit) => unit.caseIds.length >= 3 && unit.caseIds.length <= 7)).toBe(true)
    expect(queue.flatMap((unit) => unit.caseIds)).toEqual(ids)
  })

  it('is repeatable for a saved queue seed', () => {
    expect(createReviewQueue(ids, 99)).toEqual(createReviewQueue(ids, 99))
  })

  it('randomizes the label order once and preserves every label', () => {
    const first = randomizeCaseOrder(ids, 12345)
    expect(first).toEqual(randomizeCaseOrder(ids, 12345))
    expect(first).not.toEqual(randomizeCaseOrder(ids, 54321))
    expect([...first].sort()).toEqual([...ids].sort())
  })

  it('builds the same randomized FIFO units from the same saved seed', () => {
    const queue = createRandomizedReviewQueue(ids, 20260823)
    expect(queue).toEqual(createRandomizedReviewQueue(ids, 20260823))
    expect(queue[0].kind).toBe('single')
    expect(queue[1].kind).toBe('single')
    expect(queue[2]).toMatchObject({ kind: 'batch' })
    expect(queue[2].caseIds).toHaveLength(5)
    expect(queue.flatMap((unit) => unit.caseIds).sort()).toEqual([...ids].sort())
  })
})
