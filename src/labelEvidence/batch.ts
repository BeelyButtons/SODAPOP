import { casesForCategory, ROUTING_CATEGORIES } from './cases'
import { evaluateCase } from './evaluate'
import type { LabelEvidenceCase, SimulatedBatch } from './types'

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export function selectBalancedCases(seed: number): LabelEvidenceCase[] {
  const random = seededRandom(seed)
  return ROUTING_CATEGORIES.flatMap((category) => shuffled(casesForCategory(category.id), random).slice(0, 5))
}

export function createSimulatedBatch(seed = Date.now()): SimulatedBatch {
  const selected = selectBalancedCases(seed)
  const createdAt = new Date().toISOString()
  return {
    id: `BATCH-${String(seed).slice(-6)}`,
    seed,
    createdAt,
    caseIds: selected.map((item) => item.id),
    evaluations: selected.map(evaluateCase),
  }
}
