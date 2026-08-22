import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CaseFilePreview } from './CaseFilePreview'

describe('CaseFilePreview', () => {
  const previewProps = { onBack: vi.fn(), onOpenLabel: vi.fn() }

  it('leads with one plain-language task and keeps records collapsed', () => {
    render(<CaseFilePreview {...previewProps} />)

    expect(screen.getByRole('heading', { name: /case file is ready/i })).toBeInTheDocument()
    expect(screen.getByText(/This is not an approval/i)).toBeInTheDocument()
    expect(screen.getByText(/See the records behind this result/i).closest('details')).not.toHaveAttribute('open')
  })

  it('shows an imported age and origin claim as an evidence need', async () => {
    const user = userEvent.setup()
    render(<CaseFilePreview {...previewProps} />)

    await user.selectOptions(screen.getByRole('combobox', { name: /Pilot case/i }), 'spirits-imported-protected')

    expect(screen.getByRole('heading', { name: /label claim has not been supported/i })).toBeInTheDocument()
    expect(screen.getByText(/applicant made the claim/i)).toBeInTheDocument()
  })

  it('stops before label review when a required formula is missing', async () => {
    const user = userEvent.setup()
    render(<CaseFilePreview {...previewProps} />)

    await user.selectOptions(screen.getByRole('combobox', { name: /Pilot case/i }), 'wine-domestic-specialty')

    expect(screen.getByRole('heading', { name: /case file is incomplete/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continue to matching label review/i })).not.toBeInTheDocument()
  })

  it('hands a ready packet to its matching existing label review', async () => {
    const user = userEvent.setup()
    const onOpenLabel = vi.fn()
    render(<CaseFilePreview onBack={vi.fn()} onOpenLabel={onOpenLabel} />)

    await user.click(screen.getByRole('button', { name: /Continue to matching label review/i }))
    expect(onOpenLabel).toHaveBeenCalledWith('valid')
  })
})
