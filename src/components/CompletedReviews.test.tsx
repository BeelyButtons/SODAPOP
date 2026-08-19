import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { QueueProgress } from '../reviewQueue'
import { CompletedReviews } from './CompletedReviews'

const progress: QueueProgress = {
  records: {
    'rev-pass-1': {
      id: 'rev-pass-1', sampleId: 'valid', revision: 1, finalDecision: 'pass', staffDecisions: {},
      rotationDegrees: 0, completedAt: '2026-08-18T12:00:00.000Z',
    },
    'rev-fail-1': {
      id: 'rev-fail-1', sampleId: 'wrong-abv', revision: 1, finalDecision: 'fail', staffDecisions: {},
      rotationDegrees: 0, completedAt: '2026-08-19T12:00:00.000Z',
    },
  },
  currentBySample: { valid: 'rev-pass-1', 'wrong-abv': 'rev-fail-1' },
}

describe('CompletedReviews', () => {
  it('shows current completed decisions with dates and opens them by decision ID', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<CompletedReviews progress={progress} onBack={vi.fn()} onOpen={onOpen} />)

    expect(screen.getByText(/Showing 2 of 2 completed decisions/i)).toBeInTheDocument()
    expect(screen.getByText(/Decision ID rev-pass-1/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Compliant example/i }))
    expect(onOpen).toHaveBeenCalledWith('rev-pass-1')
  })

  it('searches and filters completed decisions', async () => {
    const user = userEvent.setup()
    render(<CompletedReviews progress={progress} onBack={vi.fn()} onOpen={vi.fn()} />)

    await user.type(screen.getByRole('searchbox', { name: /Search completed reviews/i }), 'ABV')
    expect(screen.getByRole('button', { name: /ABV mismatch/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Compliant example/i })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /Search completed reviews/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Decision$/i }), 'pass')
    expect(screen.getByRole('button', { name: /Compliant example/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ABV mismatch/i })).not.toBeInTheDocument()
  })

  it('sorts decisions by their saved date', async () => {
    const user = userEvent.setup()
    render(<CompletedReviews progress={progress} onBack={vi.fn()} onOpen={vi.fn()} />)

    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('ABV mismatch')
    await user.selectOptions(screen.getByRole('combobox', { name: /Decision date/i }), 'oldest')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Compliant example')
  })
})
