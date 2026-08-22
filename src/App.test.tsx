import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState({}, '', '/review')
  })

  it('explains the local processing boundary', () => {
    render(<App />)

    expect(window.location.pathname).toBe('/review')
    expect(screen.getByText(/Images are never uploaded/i)).toBeInTheDocument()
    expect(screen.getByText(/Decision-support, not automatic approval/i)).toBeInTheDocument()
  })

  it('requires a label image before review', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: /New label/i }))

    await user.click(screen.getByRole('button', { name: /Review label/i }))

    expect(screen.getByText(/Upload a label image or choose a sample/i)).toBeInTheDocument()
  })

  it('opens on a queue containing every demonstration case', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Labels to Review' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start \/ Restart label reviews/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Compliant example/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Upside-down photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Imported spirits — complete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Incorrect automatic rule set/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Production disclosures — complete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Intrastate exemption and bottle evidence/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/47 labels remaining/i)).toBeInTheDocument()
  })

  it('renders a stable full rule-set reference route', () => {
    window.history.replaceState({}, '', '/rules/distilled-spirits-domestic')
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Distilled spirits — Domestic' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Base rules' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Conditional rules' })).toBeInTheDocument()
  })

  it('keeps completed reviews available in primary navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    const completedLink = screen.getByRole('link', { name: /Completed reviews/i })
    await user.click(completedLink)

    expect(window.location.pathname).toBe('/review/completed')
    expect(completedLink).toHaveClass('active')
    expect(screen.getByRole('heading', { name: /Completed label review decisions/i })).toBeInTheDocument()
  })

  it('opens the document-aware preview without replacing the review queue', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Preview document-aware review/i }))

    expect(window.location.pathname).toBe('/case-files')
    expect(screen.getByRole('heading', { name: /Document-aware case review/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Review queue/i }))
    expect(window.location.pathname).toBe('/review')
    expect(screen.getByRole('heading', { name: 'Labels to Review' })).toBeInTheDocument()
  })
})
