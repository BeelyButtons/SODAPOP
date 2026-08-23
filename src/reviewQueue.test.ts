import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendReviewRecord,
  changeDecisionFromRoute,
  clearQueueProgress,
  completedIdFromRoute,
  currentReviewForSample,
  emptyQueueProgress,
  nextRemainingSample,
  queueIdFromRoute,
  readQueueProgress,
  reviewHistoryForSample,
  saveQueueProgress,
  type QueueDecision,
  type QueueProgress,
  type ReviewRecord,
} from './reviewQueue'

function record(id: string, sampleId: string, finalDecision: QueueDecision, revision = 1): ReviewRecord {
  return {
    id,
    sampleId,
    revision,
    finalDecision,
    staffDecisions: {},
    rotationDegrees: 0,
    completedAt: `2026-08-${17 + revision}T00:00:00.000Z`,
  }
}

function progressWith(entries: Array<[string, QueueDecision]>): QueueProgress {
  const progress = emptyQueueProgress()
  for (const [sampleId, decision] of entries) {
    const id = `rev-${sampleId}-1`
    progress.records[id] = record(id, sampleId, decision)
    progress.currentBySample[sampleId] = id
  }
  return progress
}

describe('review queue', () => {
  beforeEach(() => window.localStorage.clear())

  it('stores queue decisions only in browser storage', () => {
    const progress = progressWith([['valid', 'pass'], ['wrong-abv', 'fail']])
    saveQueueProgress(progress)
    expect(readQueueProgress()).toEqual(progress)
    clearQueueProgress()
    expect(readQueueProgress()).toEqual(emptyQueueProgress())
  })

  it('migrates version-two decisions to review IDs without losing saved work', () => {
    window.localStorage.setItem('labelevidence-review-queue-v2', JSON.stringify({
      valid: { finalDecision: 'pass', staffDecisions: { brand: 'pass' }, rotationDegrees: 90, completedAt: '2026-08-18T00:00:00.000Z' },
    }))

    const migrated = readQueueProgress()
    expect(currentReviewForSample(migrated, 'valid')).toMatchObject({
      id: 'rev-valid-1', sampleId: 'valid', revision: 1, finalDecision: 'pass', rotationDegrees: 90,
    })
  })

  it('resumes with the first remaining case', () => {
    expect(nextRemainingSample(progressWith([['valid', 'pass']]))?.id).toBe('wrong-abv')
  })

  it('wraps to any remaining case after a completed review', () => {
    const progress = progressWith([
      ['valid', 'pass'], ['wrong-abv', 'fail'], ['warning-case', 'pass'], ['warning-bold', 'pass'],
      ['missing-warning', 'fail'], ['angled-photo', 'pass'], ['glare-photo', 'pass'], ['upside-down', 'pass'],
    ])
    expect(nextRemainingSample(progress, 'upside-down')?.id).toBe('imported-clear')
  })

  it('creates immutable revisions and points the queue to the latest decision', () => {
    const first = progressWith([['valid', 'fail']])
    const original = currentReviewForSample(first, 'valid')!
    const amended = appendReviewRecord(first, 'valid', {
      finalDecision: 'pass',
      staffDecisions: { brand: 'pass' },
      rotationDegrees: 0,
      completedAt: '2026-08-19T00:00:00.000Z',
    }, original.id)

    expect(amended.record).toMatchObject({ sampleId: 'valid', revision: 2, supersedesId: original.id, finalDecision: 'pass' })
    expect(currentReviewForSample(amended.progress, 'valid')?.id).toBe(amended.record.id)
    expect(reviewHistoryForSample(amended.progress, 'valid').map((entry) => entry.id)).toEqual([amended.record.id, original.id])
  })

  it('extracts queue, completed-decision, and amendment routes', () => {
    expect(queueIdFromRoute('/review/glare-photo')).toBe('glare-photo')
    expect(queueIdFromRoute('/review/new')).toBeNull()
    expect(queueIdFromRoute('/review/completed/rev-a1')).toBeNull()
    expect(completedIdFromRoute('/review/completed/rev-a1')).toBe('rev-a1')
    expect(changeDecisionFromRoute('/review/completed/rev-a1/change/warningFormat')).toEqual({ reviewId: 'rev-a1', checkId: 'warningFormat' })
  })
})
