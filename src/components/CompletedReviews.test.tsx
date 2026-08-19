import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CompletedReviews } from './CompletedReviews'

describe('CompletedReviews', () => {
  it('shows only completed labels and opens a locked decision', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(
      <CompletedReviews
        progress={{
          valid: {
            finalDecision: 'pass',
            staffDecisions: {},
            rotationDegrees: 0,
            completedAt: '2026-08-18T00:00:00.000Z',
          },
        }}
        onBack={vi.fn()}
        onOpen={onOpen}
      />,
    )

    expect(screen.getByRole('button', { name: /Compliant example/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ABV mismatch/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Compliant example/i }))
    expect(onOpen).toHaveBeenCalledWith('valid')
  })
})
