export function normalizeWords(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[’‘]/g, "'")
    .replace(/[^a-zA-Z0-9%]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeFieldText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[’‘]/g, "'")
    .replace(/[^a-zA-Z0-9%&]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function collapseWhitespace(value: string) {
  return value.replace(/[\u00a0\s]+/g, ' ').trim()
}

function levenshtein(left: string, right: string) {
  if (!left.length) return right.length
  if (!right.length) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = new Array<number>(right.length + 1)

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

export function similarity(left: string, right: string) {
  const normalizedLeft = normalizeWords(left)
  const normalizedRight = normalizeWords(right)
  const longest = Math.max(normalizedLeft.length, normalizedRight.length)
  if (!longest) return 1
  return 1 - levenshtein(normalizedLeft, normalizedRight) / longest
}

export function bestObservedLine(expected: string, text: string) {
  const expectedNormalized = normalizeWords(expected)
  const fullNormalized = normalizeWords(text)
  if (fullNormalized.includes(expectedNormalized)) return expected

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const candidates = [...lines]
  for (let index = 0; index < lines.length - 1; index += 1) {
    candidates.push(`${lines[index]} ${lines[index + 1]}`)
  }

  return candidates.reduce(
    (best, candidate) =>
      similarity(expected, candidate) > similarity(expected, best) ? candidate : best,
    candidates[0] ?? '',
  )
}

export function parseAlcohol(value: string) {
  const abvMatch = value.match(/(\d{1,3}(?:\.\d+)?)\s*%/i)
  const proofMatch = value.match(/(\d{1,3}(?:\.\d+)?)\s*proof/i)
  return {
    abv: abvMatch ? Number(abvMatch[1]) : null,
    proof: proofMatch ? Number(proofMatch[1]) : null,
  }
}

export function findAlcohol(value: string) {
  const match = value.match(/\d{1,3}(?:\.\d+)?\s*%[^\n]{0,40}(?:\d{1,3}(?:\.\d+)?\s*proof)?/i)
  return match?.[0]?.trim() ?? ''
}

export function parseVolume(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(mL|L|fl\.?\s*oz\.?)/i)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2].toLowerCase().replace(/[.\s]/g, '')
  if (unit === 'l') return amount * 1000
  if (unit === 'floz') return amount * 29.5735
  return amount
}

export function findVolume(value: string) {
  const match = value.match(/\d+(?:\.\d+)?\s*(?:mL|L|fl\.?\s*oz\.?)/i)
  return match?.[0]?.trim() ?? ''
}
