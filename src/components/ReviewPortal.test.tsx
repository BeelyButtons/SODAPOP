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
  it('shows only remaining reviews in a copyable table', () => {
    render(<ReviewPortal progress={progress} onStart={vi.fn()} onSelect={vi.fn()} onCompleted={vi.fn()} onReset={vi.fn()} />)

    expect(screen.getByRole('table', { name: /Labels waiting for review/i })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /ABV mismatch/i })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Compliant example/i })).not.toBeInTheDocument()
  })

  it('searches and filters the remaining queue', async () => {
    const user = userEvent.setup()
    render(<ReviewPortal progress={progress} onStart={vi.fn()} onSelect={vi.fn()} onCompleted={vi.fn()} onReset={vi.fn()} />)

    await user.type(screen.getByRole('searchbox', { name: /Search labels to review/i }), 'origin conflict')
    expect(screen.getByRole('row', { name: /Imported origin conflict/i })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /ABV mismatch/i })).not.toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /Search labels to review/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /Source/i }), 'imported')
    expect(screen.getByRole('row', { name: /Imported spirits — complete/i })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /ABV mismatch/i })).not.toBeInTheDocument()
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
