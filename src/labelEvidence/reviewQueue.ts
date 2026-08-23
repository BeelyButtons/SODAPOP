export type ReviewQueueUnit =
  | { id: string; kind: 'single'; caseIds: [string] }
  | { id: string; kind: 'batch'; caseIds: string[] }

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function createReviewQueue(caseIds: string[], seed: number): ReviewQueueUnit[] {
  const units: ReviewQueueUnit[] = []
  const first = caseIds[0]
  const second = caseIds[1]
  if (first) units.push({ id: 'single-001', kind: 'single', caseIds: [first] })
  if (second) units.push({ id: 'single-002', kind: 'single', caseIds: [second] })
  const firstBatch = caseIds.slice(2, 7)
  if (firstBatch.length) units.push({ id: 'batch-001', kind: 'batch', caseIds: firstBatch })

  const random = seededRandom(seed)
  let cursor = 7
  let singleNumber = 3
  let batchNumber = 2
  while (cursor < caseIds.length) {
    const remaining = caseIds.length - cursor
    if (remaining >= 3 && random() < .2) {
      const requestedLength = 3 + Math.floor(random() * 5)
      const length = Math.min(requestedLength, remaining)
      units.push({ id: `batch-${String(batchNumber).padStart(3, '0')}`, kind: 'batch', caseIds: caseIds.slice(cursor, cursor + length) })
      cursor += length
      batchNumber += 1
    } else {
      units.push({ id: `single-${String(singleNumber).padStart(3, '0')}`, kind: 'single', caseIds: [caseIds[cursor]] })
      cursor += 1
      singleNumber += 1
    }
  }
  return units
}
