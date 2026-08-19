import { SAMPLE_LABELS, type SampleLabel } from './data/sampleLabels'

export type QueueDecision = 'pass' | 'fail'
export type QueueProgress = Record<string, QueueDecision>

const storageKey = 'sodapop-review-queue-v1'

export function readQueueProgress(): QueueProgress {
  try {
    const saved = window.localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) as QueueProgress : {}
  } catch {
    return {}
  }
}

export function saveQueueProgress(progress: QueueProgress) {
  window.localStorage.setItem(storageKey, JSON.stringify(progress))
}

export function clearQueueProgress() {
  window.localStorage.removeItem(storageKey)
}

export function queueSample(id: string | null): SampleLabel | undefined {
  return SAMPLE_LABELS.find((sample) => sample.id === id)
}

export function queueIdFromRoute(route: string) {
  if (!route.startsWith('/review/') || route === '/review/new') return null
  return decodeURIComponent(route.slice('/review/'.length))
}

export function nextRemainingSample(progress: QueueProgress, afterId?: string) {
  const start = afterId ? SAMPLE_LABELS.findIndex((sample) => sample.id === afterId) + 1 : 0
  const ordered = [...SAMPLE_LABELS.slice(start), ...SAMPLE_LABELS.slice(0, start)]
  return ordered.find((sample) => !progress[sample.id])
}
