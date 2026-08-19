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
    await user.hover(screen.getByRole('article', { name: /Government warning wording/i }))
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

    await user.hover(screen.getByRole('article', { name: /Government warning wording/i }))
    expect(screen.getByText('Confirmed issue')).toBeInTheDocument()
    expect(container.querySelector('.ocr-highlight-box')).toHaveClass('highlight-mismatch')
  })

  it('renders transformed OCR coordinates as an angled polygon', async () => {
    const user = userEvent.setup()
    const angledResult: ReviewOutcome = {
      ...result,
      checks: result.checks.map((check) =>
        check.id === 'warningText' && check.highlight
          ? {
              ...check,
              highlight: {
                ...check.highlight,
                boxes: [{
                  x0: 10,
                  y0: 120,
                  x1: 40,
                  y1: 138,
                  points: [
                    { x: 10, y: 124 },
                    { x: 40, y: 120 },
                    { x: 40, y: 134 },
                    { x: 10, y: 138 },
                  ],
                }],
              },
            }
          : check,
      ),
    }
    const { container } = render(
      <ReviewResults result={angledResult} previewUrl="label.png" fileName="label.png" />,
    )

    await user.hover(screen.getByRole('article', { name: /Government warning wording/i }))
    expect(container.querySelector('polygon')).toHaveAttribute(
      'points',
      '10,124 40,120 40,134 10,138',
    )
  })

  it('keeps a highlight selected after pointer hover ends', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ReviewResults result={result} previewUrl="label.png" fileName="label.png" />,
    )
    const check = screen.getByRole('article', { name: /Government warning wording/i })

    await user.click(screen.getByRole('button', { name: /Locate detected area on label/i }))
    await user.unhover(check)
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
  })

  it('shows a highlight when the location control receives keyboard focus', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ReviewResults result={result} previewUrl="label.png" fileName="label.png" />,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: /Locate detected area on label/i })).toHaveFocus()
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
  })

  it('requires every staff determination before enabling final submission', async () => {
    const user = userEvent.setup()
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const submit = screen.getByRole('button', { name: /Submit final decision/i })

    expect(submit).toBeDisabled()
    for (const button of screen.getAllByRole('button', { name: 'Pass' })) {
      await user.click(button)
    }

    expect(screen.getByRole('heading', { name: 'Final determination: Pass' })).toBeInTheDocument()
    expect(submit).toBeEnabled()
    await user.click(submit)
    expect(screen.getByText('Final Pass decision recorded for this browser session.')).toBeInTheDocument()
  })

  it('makes the final determination fail when any item is marked fail', async () => {
    const user = userEvent.setup()
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const passButtons = screen.getAllByRole('button', { name: 'Pass' })
    const failButtons = screen.getAllByRole('button', { name: 'Fail' })

    await user.click(failButtons[0])
    for (const button of passButtons.slice(1)) await user.click(button)

    expect(screen.getByRole('heading', { name: 'Final determination: Fail' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Submit final decision/i })).toBeEnabled()
  })
})
