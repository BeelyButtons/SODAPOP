import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(screen.getByText('Pass', { selector: '.highlight-key' })).toBeInTheDocument()
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
    expect(screen.getByText('Mismatch', { selector: '.highlight-key' })).toBeInTheDocument()
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

    await user.click(check)
    await user.unhover(check)
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
  })

  it('shows a highlight when the card receives keyboard focus', () => {
    const { container } = render(
      <ReviewResults result={result} previewUrl="label.png" fileName="label.png" />,
    )

    const check = screen.getByRole('article', { name: /Government warning wording/i })
    fireEvent.focus(check)
    expect(container.querySelectorAll('.ocr-highlight-box')).toHaveLength(1)
  })

  it('requires every staff determination before offering pass confirmation', async () => {
    const user = userEvent.setup()
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: 'Pass' })) {
      await user.click(button)
    }

    expect(screen.getByRole('heading', { name: /Confirm this label has passed/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Confirm Pass decision/i }))
    expect(screen.getByText('Final Pass decision recorded for this browser session.')).toBeInTheDocument()
  })

  it('makes the final determination fail when any item is marked fail', async () => {
    const user = userEvent.setup()
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const failButtons = screen.getAllByRole('button', { name: 'Fail' })

    await user.click(failButtons[0])
    expect(screen.getByRole('alertdialog', { name: /Confirm this label has failed/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Go back to review/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(failButtons[0])
    await user.click(screen.getByRole('button', { name: /Confirm failure/i }))

    expect(screen.getByText('Final Fail decision recorded for this browser session.')).toBeInTheDocument()
  })

  it('puts human-review findings before confident passes', () => {
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const cards = screen.getAllByRole('article')
    expect(cards[0]).toHaveAccessibleName(/Government warning format/i)
    expect(cards[1]).toHaveAccessibleName(/Government warning wording/i)
  })

  it('rotates in 90-degree steps and requires saving the orientation', async () => {
    const user = userEvent.setup()
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const save = screen.getByRole('button', { name: /Save orientation/i })
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Rotate 90 degrees clockwise/i }))
    expect(screen.getByText(/90° orientation/i)).toBeInTheDocument()
    expect(save).toBeEnabled()
    await user.click(save)
    expect(save).toBeDisabled()
  })

  it('renders completed decisions as locked evidence', () => {
    render(
      <ReviewResults
        result={result}
        previewUrl="label.png"
        fileName="label.png"
        readOnly
        recordedDecision="fail"
        initialDecisions={{ warningText: 'pass', warningFormat: 'fail' }}
      />,
    )

    expect(screen.getByText('Final decision: Fail')).toBeInTheDocument()
    expect(screen.getAllByText('Staff determination', { selector: '.locked-decision span' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Pass' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fail' })).not.toBeInTheDocument()
  })
})
