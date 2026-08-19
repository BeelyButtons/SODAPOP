import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearQueueProgress,
  completedIdFromRoute,
  nextRemainingSample,
  queueIdFromRoute,
  readQueueProgress,
  repeatIdFromRoute,
  saveQueueProgress,
  type QueueDecision,
  type ReviewRecord,
} from './reviewQueue'

function record(finalDecision: QueueDecision): ReviewRecord {
  return { finalDecision, staffDecisions: {}, rotationDegrees: 0, completedAt: '2026-08-18T00:00:00.000Z' }
}

describe('review queue', () => {
  beforeEach(() => window.localStorage.clear())

  it('stores queue decisions only in browser storage', () => {
    const progress = { valid: record('pass'), 'wrong-abv': record('fail') }
    saveQueueProgress(progress)
    expect(readQueueProgress()).toEqual(progress)
    clearQueueProgress()
    expect(readQueueProgress()).toEqual({})
  })

  it('resumes with the first remaining case', () => {
    expect(nextRemainingSample({ valid: record('pass') })?.id).toBe('wrong-abv')
  })

  it('wraps to any remaining case after a completed review', () => {
    const progress = {
      valid: record('pass'),
      'wrong-abv': record('fail'),
      'warning-case': record('pass'),
      'warning-bold': record('pass'),
      'missing-warning': record('fail'),
      'angled-photo': record('pass'),
      'glare-photo': record('pass'),
      'upside-down': record('pass'),
    }
    expect(nextRemainingSample(progress, 'upside-down')?.id).toBe('dark-label')
  })

  it('extracts a queue id without treating the new-review route as a case', () => {
    expect(queueIdFromRoute('/review/glare-photo')).toBe('glare-photo')
    expect(queueIdFromRoute('/review/new')).toBeNull()
    expect(queueIdFromRoute('/review/completed/valid')).toBeNull()
    expect(completedIdFromRoute('/review/completed/valid')).toBe('valid')
    expect(repeatIdFromRoute('/review/completed/valid/review-again')).toBe('valid')
  })
})
