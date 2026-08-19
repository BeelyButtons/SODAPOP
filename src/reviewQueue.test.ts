import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearQueueProgress,
  nextRemainingSample,
  queueIdFromRoute,
  readQueueProgress,
  saveQueueProgress,
} from './reviewQueue'

describe('review queue', () => {
  beforeEach(() => window.localStorage.clear())

  it('stores queue decisions only in browser storage', () => {
    saveQueueProgress({ valid: 'pass', 'wrong-abv': 'fail' })
    expect(readQueueProgress()).toEqual({ valid: 'pass', 'wrong-abv': 'fail' })
    clearQueueProgress()
    expect(readQueueProgress()).toEqual({})
  })

  it('resumes with the first remaining case', () => {
    expect(nextRemainingSample({ valid: 'pass' })?.id).toBe('wrong-abv')
  })

  it('wraps to any remaining case after a completed review', () => {
    const progress = {
      valid: 'pass' as const,
      'wrong-abv': 'fail' as const,
      'warning-case': 'pass' as const,
      'warning-bold': 'pass' as const,
      'missing-warning': 'fail' as const,
      'angled-photo': 'pass' as const,
      'glare-photo': 'pass' as const,
      'upside-down': 'pass' as const,
    }
    expect(nextRemainingSample(progress, 'upside-down')?.id).toBe('dark-label')
  })

  it('extracts a queue id without treating the new-review route as a case', () => {
    expect(queueIdFromRoute('/review/glare-photo')).toBe('glare-photo')
    expect(queueIdFromRoute('/review/new')).toBeNull()
  })
})
