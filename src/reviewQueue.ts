import { SAMPLE_LABELS, type SampleLabel } from './data/sampleLabels'
import type { ReviewCheck, ReviewOutcome } from './domain/reviewSchema'

export type QueueDecision = 'pass' | 'fail'
export type StaffDecisions = Partial<Record<ReviewCheck['id'], QueueDecision>>
export type SavedRotation = 0 | 90 | 180 | 270

export type ReviewRecord = {
  finalDecision: QueueDecision
  staffDecisions: StaffDecisions
  result?: ReviewOutcome
  rotationDegrees: SavedRotation
  completedAt: string
}

export type QueueProgress = Record<string, ReviewRecord>

const storageKey = 'sodapop-review-queue-v2'
const legacyStorageKey = 'sodapop-review-queue-v1'

function normalizeLegacyProgress(value: unknown): QueueProgress {
  if (!value || typeof value !== 'object') return {}
  const normalized: QueueProgress = {}
  for (const [id, entry] of Object.entries(value)) {
    if (entry === 'pass' || entry === 'fail') {
      normalized[id] = { finalDecision: entry, staffDecisions: {}, rotationDegrees: 0, completedAt: '' }
    } else if (entry && typeof entry === 'object' && 'finalDecision' in entry) {
      normalized[id] = entry as ReviewRecord
    }
  }
  return normalized
}

export function readQueueProgress(): QueueProgress {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) return normalizeLegacyProgress(JSON.parse(saved))
    const legacy = window.localStorage.getItem(legacyStorageKey)
    if (!legacy) return {}
    const migrated = normalizeLegacyProgress(JSON.parse(legacy))
    saveQueueProgress(migrated)
    return migrated
  } catch {
    return {}
  }
}

export function saveQueueProgress(progress: QueueProgress) {
  window.localStorage.setItem(storageKey, JSON.stringify(progress))
}

export function clearQueueProgress() {
  window.localStorage.removeItem(storageKey)
  window.localStorage.removeItem(legacyStorageKey)
}

export function queueSample(id: string | null): SampleLabel | undefined {
  return SAMPLE_LABELS.find((sample) => sample.id === id)
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

export function repeatIdFromRoute(route: string) {
  const match = route.match(/^\/review\/completed\/([^/]+)\/review-again$/)
  return match ? decodeURIComponent(match[1]) : null
}

export function nextRemainingSample(progress: QueueProgress, afterId?: string) {
  const start = afterId ? SAMPLE_LABELS.findIndex((sample) => sample.id === afterId) + 1 : 0
  const ordered = [...SAMPLE_LABELS.slice(start), ...SAMPLE_LABELS.slice(0, start)]
  return ordered.find((sample) => !progress[sample.id])
}
