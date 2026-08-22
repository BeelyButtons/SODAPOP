import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CaseFilePreview } from './CaseFilePreview'

describe('CaseFilePreview', () => {
  it('leads with one plain-language task and keeps records collapsed', () => {
    render(<CaseFilePreview onBack={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /application conflicts with official records/i })).toBeInTheDocument()
    expect(screen.getByText(/This is not an image-reading problem/i)).toBeInTheDocument()
    expect(screen.getByText(/See the records behind this result/i).closest('details')).not.toHaveAttribute('open')
  })

  it('shows unsupported applicant wording as an evidence need', async () => {
    const user = userEvent.setup()
    render(<CaseFilePreview onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Malt beverage.*needs evidence/i }))

    expect(screen.getByRole('heading', { name: /label claim has not been supported/i })).toBeInTheDocument()
    expect(screen.getByText(/applicant made the claim/i)).toBeInTheDocument()
  })

  it('does not describe a complete packet as an approval', async () => {
    const user = userEvent.setup()
    render(<CaseFilePreview onBack={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Wine.*ready for label review/i }))

    expect(screen.getByRole('heading', { name: /case file is ready/i })).toBeInTheDocument()
    expect(screen.getByText(/This is not an approval/i)).toBeInTheDocument()
  })
})
