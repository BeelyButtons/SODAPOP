import { describe, expect, it } from 'vitest'
import { createReviewQueue } from './reviewQueue'

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
})
