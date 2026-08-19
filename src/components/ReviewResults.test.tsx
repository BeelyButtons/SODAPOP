import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { ReviewOutcome } from '../domain/reviewSchema'
import { ReviewResults } from './ReviewResults'

const result: ReviewOutcome = {
  status: 'needs_review',
  ocrText: 'GOVERNMENT WARNING: sample warning',
  ocrConfidence: 92,
  durationMs: 1_200,
  checks: [
    {
      id: 'warningText',
      label: 'Government warning wording',
      status: 'pass',
      expected: 'Required warning',
      observed: 'Detected warning',
      explanation: 'The warning text matches.',
      highlight: {
        imageWidth: 100,
        imageHeight: 200,
        boxes: [{ x0: 10, y0: 120, x1: 40, y1: 135 }],
      },
    },
    {
      id: 'warningFormat',
      label: 'Government warning format',
      status: 'needs_review',
      expected: 'Required format',
      observed: 'Detected heading',
      explanation: 'Confirm formatting visually.',
    },
  ],
}

describe('ReviewResults', () => {
  it('shows OCR boxes when a coordinate-backed result is hovered', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ReviewResults result={result} previewUrl="label.png" fileName="label.png" />,
    )

    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(0)
    await user.hover(screen.getByRole('button', { name: /Government warning wording/i }))
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
    expect(screen.getByText('Matched text')).toBeInTheDocument()
    expect(container.querySelector('.ocr-highlight-box')).toHaveClass('highlight-pass')
  })

  it('uses red highlighting for confirmed mismatches', async () => {
    const user = userEvent.setup()
    const mismatchResult: ReviewOutcome = {
      ...result,
      status: 'mismatch',
      checks: result.checks.map((check) =>
        check.id === 'warningText' ? { ...check, status: 'mismatch' as const } : check,
      ),
    }
    const { container } = render(
      <ReviewResults result={mismatchResult} previewUrl="label.png" fileName="label.png" />,
    )

    await user.hover(screen.getByRole('button', { name: /Government warning wording/i }))
    expect(screen.getByText('Confirmed issue')).toBeInTheDocument()
    expect(container.querySelector('.ocr-highlight-box')).toHaveClass('highlight-mismatch')
  })

  it('keeps a highlight selected after pointer hover ends', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ReviewResults result={result} previewUrl="label.png" fileName="label.png" />,
    )
    const check = screen.getByRole('button', { name: /Government warning wording/i })

    await user.click(check)
    await user.unhover(check)
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
  })

  it('shows a highlight when the result receives keyboard focus', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ReviewResults result={result} previewUrl="label.png" fileName="label.png" />,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: /Government warning wording/i })).toHaveFocus()
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
  })
})
