import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { QueueProgress } from '../reviewQueue'
import { ReviewPortal } from './ReviewPortal'

const progress: QueueProgress = {
  records: {
    'rev-valid-1': {
      id: 'rev-valid-1', sampleId: 'valid', revision: 1, finalDecision: 'pass', staffDecisions: {},
      rotationDegrees: 0, completedAt: '2026-08-18T12:00:00.000Z',
    },
  },
  currentBySample: { valid: 'rev-valid-1' },
}

describe('ReviewPortal', () => {
  it('renumbers only the remaining reviews from one', () => {
    render(<ReviewPortal progress={progress} onStart={vi.fn()} onSelect={vi.fn()} onCompleted={vi.fn()} onReset={vi.fn()} />)

    const firstRemaining = screen.getByRole('button', { name: /ABV mismatch/i })
    expect(firstRemaining).toHaveTextContent(/^1/)
  })

  it('confirms before clearing saved review history', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    render(<ReviewPortal progress={progress} onStart={vi.fn()} onSelect={vi.fn()} onCompleted={vi.fn()} onReset={onReset} />)

    await user.click(screen.getByRole('button', { name: /Reset review queue/i }))
    expect(onReset).not.toHaveBeenCalled()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset review queue' }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
