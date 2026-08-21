import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
      requirements: [
        '“GOVERNMENT WARNING” is uppercase and bold',
        'Text following the heading is not bold',
        'Minimum type size: 2 mm',
        'Maximum density: 25 characters per inch',
        'Text contrasts with its background',
        'Warning is separated from other information',
      ],
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

  it('presents warning-format requirements as a scannable list', () => {
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)

    const requirements = screen.getByRole('region', { name: /Government warning format requirements/i })
    expect(within(requirements).getByText('Requirements to verify')).toBeInTheDocument()
    expect(within(requirements).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText('AI determination: Human review required.')).toBeInTheDocument()
    expect(screen.queryByText(/not an automated failure/i)).not.toBeInTheDocument()
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

  it('zooms the image and highlight layer together without rerunning review', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const canvas = container.querySelector('.zoom-canvas')

    await user.click(screen.getByRole('article', { name: /Government warning wording/i }))
    expect(screen.getByText(/100% zoom/i)).toBeInTheDocument()
    expect(canvas).toHaveStyle({ transform: 'scale(1)' })
    expect((canvas as HTMLElement).style.transformOrigin).toMatch(/^25% 63\.7/)
    expect(container.querySelector('.ocr-highlight-layer')).toBe(canvas?.querySelector('.ocr-highlight-layer'))

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText(/110% zoom/i)).toBeInTheDocument()
    expect(canvas).toHaveStyle({ transform: 'scale(1.1)' })
    expect(screen.queryByText(/Zoom above|Click and drag/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reset zoom to 100 percent/i }))
    expect(screen.getByText(/100% zoom/i)).toBeInTheDocument()
    expect(canvas).toHaveStyle({ transform: 'scale(1)' })
  })

  it('keeps orientation and zoom controls on one compact row', () => {
    render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)

    const orientation = screen.getByRole('generic', { name: /Label orientation controls/i })
    const zoomControls = screen.getByRole('generic', { name: /Label zoom controls/i })
    expect(orientation.parentElement).toBe(zoomControls.parentElement)
    expect(orientation.parentElement).toHaveClass('preview-controls')
    expect(screen.queryByText(/Zoom above|Click and drag/i)).not.toBeInTheDocument()
  })

  it('renders the compliance command before queued-label context', () => {
    render(
      <ReviewResults
        result={result}
        previewUrl="label.png"
        fileName="label.png"
        pageContext={{ eyebrow: 'Queued label review', title: 'Angled tabletop photo', description: 'A photographed label.' }}
      />,
    )

    const command = screen.getByRole('heading', { name: /Make your label compliance determination/i })
    const pageTitle = screen.getByRole('heading', { name: /Angled tabletop photo/i })
    expect(command.compareDocumentPosition(pageTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('pans a zoomed image and its highlight as one draggable layer', async () => {
    const user = userEvent.setup()
    const { container } = render(<ReviewResults result={result} previewUrl="label.png" fileName="label.png" />)
    const frame = container.querySelector('.rotation-stage') as HTMLElement
    const panCanvas = container.querySelector('.pan-canvas')

    await user.click(screen.getByRole('article', { name: /Government warning wording/i }))
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.pointerDown(frame, { pointerId: 7, button: 0, clientX: 100, clientY: 120 })
    fireEvent.pointerMove(frame, { pointerId: 7, clientX: 145, clientY: 95 })

    expect(frame).toHaveClass('is-panning')
    expect(panCanvas).toHaveStyle({ transform: 'translate3d(45px, -25px, 0)' })
    expect(container.querySelector('.ocr-highlight-layer')?.closest('.pan-canvas')).toBe(panCanvas)

    fireEvent.pointerUp(frame, { pointerId: 7 })
    expect(frame).not.toHaveClass('is-panning')

    await user.click(screen.getByRole('button', { name: /Reset zoom to 100 percent/i }))
    expect(panCanvas).toHaveStyle({ transform: 'translate3d(0px, 0px, 0)' })
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

  it('confirms a per-card decision change before opening amendment mode', async () => {
    const user = userEvent.setup()
    const onChangeDecision = vi.fn()
    render(
      <ReviewResults
        result={result}
        previewUrl="label.png"
        fileName="label.png"
        readOnly
        recordedDecision="fail"
        initialDecisions={{ warningText: 'pass', warningFormat: 'fail' }}
        onChangeDecision={onChangeDecision}
      />,
    )

    await user.click(screen.getAllByRole('button', { name: /Change decision/i })[0])
    expect(onChangeDecision).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /Continue to change decision/i }))
    expect(onChangeDecision).toHaveBeenCalledWith('warningFormat')
  })

  it('does not offer decision changes for cards skipped after quick fail', () => {
    render(
      <ReviewResults
        result={result}
        previewUrl="label.png"
        fileName="label.png"
        readOnly
        recordedDecision="fail"
        initialDecisions={{ warningText: 'fail' }}
        onChangeDecision={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: /Change decision/i })).toHaveLength(1)
    expect(within(screen.getByRole('article', { name: /Government warning format/i })).queryByRole('button', { name: /Change decision/i })).not.toBeInTheDocument()
  })

  it('preserves prior answers while allowing the selected decision to be amended', async () => {
    const user = userEvent.setup()
    const onFinalDecision = vi.fn()
    render(
      <ReviewResults
        result={result}
        previewUrl="label.png"
        fileName="label.png"
        recordedDecision="fail"
        initialDecisions={{ warningText: 'pass', warningFormat: 'fail' }}
        amendmentCheckId="warningFormat"
        onFinalDecision={onFinalDecision}
      />,
    )

    expect(screen.getAllByText('Staff determination', { selector: '.locked-decision span' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Pass' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Pass' }))
    await user.click(screen.getByRole('button', { name: /Confirm Pass decision/i }))
    expect(onFinalDecision).toHaveBeenCalledWith('pass', { warningText: 'pass', warningFormat: 'pass' }, 0)
  })
})
