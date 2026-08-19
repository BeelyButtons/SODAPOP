import { SAMPLE_LABELS, type SampleLabel } from './data/sampleLabels'
import type { ReviewCheck, ReviewOutcome } from './domain/reviewSchema'

export type QueueDecision = 'pass' | 'fail'
export type StaffDecisions = Partial<Record<ReviewCheck['id'], QueueDecision>>
export type SavedRotation = 0 | 90 | 180 | 270

export type ReviewRecord = {
  id: string
  sampleId: string
  revision: number
  supersedesId?: string
  finalDecision: QueueDecision
  staffDecisions: StaffDecisions
  result?: ReviewOutcome
  rotationDegrees: SavedRotation
  completedAt: string
}

export type QueueProgress = {
  records: Record<string, ReviewRecord>
  currentBySample: Record<string, string>
}

export type ReviewRecordInput = Pick<
  ReviewRecord,
  'finalDecision' | 'staffDecisions' | 'result' | 'rotationDegrees' | 'completedAt'
>

const storageKey = 'sodapop-review-queue-v3'
const previousStorageKey = 'sodapop-review-queue-v2'
const legacyStorageKey = 'sodapop-review-queue-v1'

export function emptyQueueProgress(): QueueProgress {
  return { records: {}, currentBySample: {} }
}

function isQueueDecision(value: unknown): value is QueueDecision {
  return value === 'pass' || value === 'fail'
}

function migratedReviewId(sampleId: string, revision = 1) {
  return `rev-${sampleId}-${revision}`
}

function normalizeV3Progress(value: unknown): QueueProgress | null {
  if (!value || typeof value !== 'object' || !('records' in value) || !('currentBySample' in value)) return null
  const candidate = value as QueueProgress
  if (!candidate.records || typeof candidate.records !== 'object') return null
  if (!candidate.currentBySample || typeof candidate.currentBySample !== 'object') return null
  return candidate
}

function migrateLegacyProgress(value: unknown): QueueProgress {
  const migrated = emptyQueueProgress()
  if (!value || typeof value !== 'object') return migrated

  for (const [sampleId, entry] of Object.entries(value)) {
    const legacyRecord = isQueueDecision(entry)
      ? { finalDecision: entry, staffDecisions: {}, rotationDegrees: 0 as SavedRotation, completedAt: '' }
      : entry && typeof entry === 'object' && 'finalDecision' in entry
        ? entry as Partial<ReviewRecord>
        : null
    if (!legacyRecord || !isQueueDecision(legacyRecord.finalDecision)) continue

    const id = migratedReviewId(sampleId)
    migrated.records[id] = {
      id,
      sampleId,
      revision: 1,
      finalDecision: legacyRecord.finalDecision,
      staffDecisions: legacyRecord.staffDecisions ?? {},
      result: legacyRecord.result,
      rotationDegrees: legacyRecord.rotationDegrees ?? 0,
      completedAt: legacyRecord.completedAt ?? '',
    }
    migrated.currentBySample[sampleId] = id
  }
  return migrated
}

export function readQueueProgress(): QueueProgress {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) return normalizeV3Progress(JSON.parse(saved)) ?? emptyQueueProgress()

    const previous = window.localStorage.getItem(previousStorageKey)
    const legacy = previous ?? window.localStorage.getItem(legacyStorageKey)
    if (!legacy) return emptyQueueProgress()
    const migrated = migrateLegacyProgress(JSON.parse(legacy))
    saveQueueProgress(migrated)
    return migrated
  } catch {
    return emptyQueueProgress()
  }
}

export function saveQueueProgress(progress: QueueProgress) {
  window.localStorage.setItem(storageKey, JSON.stringify(progress))
}

export function clearQueueProgress() {
  window.localStorage.removeItem(storageKey)
  window.localStorage.removeItem(previousStorageKey)
  window.localStorage.removeItem(legacyStorageKey)
}

export function queueSample(id: string | null): SampleLabel | undefined {
  return SAMPLE_LABELS.find((sample) => sample.id === id)
}

export function currentReviewForSample(progress: QueueProgress, sampleId: string) {
  const id = progress.currentBySample[sampleId]
  return id ? progress.records[id] : undefined
}

export function currentReviewRecords(progress: QueueProgress) {
  return SAMPLE_LABELS.flatMap((sample) => {
    const record = currentReviewForSample(progress, sample.id)
    return record ? [record] : []
  })
}

export function reviewHistoryForSample(progress: QueueProgress, sampleId: string) {
  return Object.values(progress.records)
    .filter((record) => record.sampleId === sampleId)
    .sort((left, right) => right.revision - left.revision)
}

export function reviewRecordById(progress: QueueProgress, id: string | null) {
  return id ? progress.records[id] : undefined
}

function newReviewId() {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  return `rev-${randomId}`
}

export function appendReviewRecord(
  progress: QueueProgress,
  sampleId: string,
  input: ReviewRecordInput,
  supersedesId?: string,
) {
  const previous = supersedesId ? progress.records[supersedesId] : currentReviewForSample(progress, sampleId)
  const record: ReviewRecord = {
    ...input,
    id: newReviewId(),
    sampleId,
    revision: previous ? previous.revision + 1 : 1,
    ...(previous ? { supersedesId: previous.id } : {}),
  }
  const updated: QueueProgress = {
    records: { ...progress.records, [record.id]: record },
    currentBySample: { ...progress.currentBySample, [sampleId]: record.id },
  }
  return { progress: updated, record }
}

export function queueIdFromRoute(route: string) {
  const match = route.match(/^\/review\/([^/]+)$/)
  if (!match || match[1] === 'new' || match[1] === 'completed') return null
  return decodeURIComponent(match[1])
}

export function completedIdFromRoute(route: string) {
  const match = route.match(/^\/review\/completed\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

export function changeDecisionFromRoute(route: string) {
  const match = route.match(/^\/review\/completed\/([^/]+)\/change\/([^/]+)$/)
  if (!match) return null
  return {
    reviewId: decodeURIComponent(match[1]),
    checkId: decodeURIComponent(match[2]) as ReviewCheck['id'],
  }
}

export function nextRemainingSample(progress: QueueProgress, afterId?: string) {
  const start = afterId ? SAMPLE_LABELS.findIndex((sample) => sample.id === afterId) + 1 : 0
  const ordered = [...SAMPLE_LABELS.slice(start), ...SAMPLE_LABELS.slice(0, start)]
  return ordered.find((sample) => !currentReviewForSample(progress, sample.id))
}
