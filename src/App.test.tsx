import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('LabelEvidence app', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.restoreAllMocks()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  it('starts with a reviewer-facing explanation of the prototype and its coverage', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /built around the human decision/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /56 independent cases across eight review profiles/i })).toBeInTheDocument()
    expect(screen.getByText('Domestic wine — 7% ABV or higher')).toBeInTheDocument()
    expect(screen.getByText('Imported distilled spirits')).toBeInTheDocument()
    expect(screen.getByText(/does not connect to TTB systems/i)).toBeInTheDocument()
  })

  it('pre-evaluates all 56 cases into an individual review queue', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Enter the review workspace/i }))
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('of 56 pre-evaluated').previousElementSibling).toHaveTextContent('56'), { timeout: 5000 })
    expect(screen.getByRole('table', { name: /Labels needing human review/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No red flags detected' })).toBeInTheDocument()
  })

  it('saves concern resolutions and the final return decision on this device', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Enter the review workspace/i }))
    const flaggedCase = await screen.findByText('Blue Meridian Cellars · 06', {}, { timeout: 3000 })
    await user.click(flaggedCase)
    await user.click(screen.getByRole('button', { name: 'Confirm concern' }))
    await user.click(screen.getByRole('button', { name: 'Return for correction' }))
    expect(screen.getByRole('heading', { name: 'Returned for correction' })).toBeInTheDocument()
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('labelevidence.reviewer-decisions.v1') ?? '{}')
      expect(saved['LE-006'].finalDecision).toBe('returned')
    })
    expect(screen.getByRole('button', { name: /Next/i })).toBeEnabled()
  })

  it('creates and pre-evaluates a category-balanced simulated batch of 40', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Enter the review workspace/i }))
    await user.click(screen.getByRole('button', { name: /Create simulated batch of 40/i }))
    expect(screen.getByRole('heading', { name: /Simulated batch of 40/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('of 40 pre-evaluated').previousElementSibling).toHaveTextContent('40'), { timeout: 5000 })
    expect(screen.getByRole('button', { name: /Return to all 56 labels/i })).toBeInTheDocument()
  })

  it('resets review data without returning to the welcome page', async () => {
    window.localStorage.setItem('labelevidence.welcome-seen.v1', 'true')
    window.localStorage.setItem('labelevidence.reviewer-decisions.v1', JSON.stringify({ 'LE-006': { flagDecisions: { 'brand-name': 'confirmed' }, finalDecision: 'returned', note: '', decidedAt: new Date().toISOString() } }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Reset all data' }))
    expect(screen.getByRole('heading', { name: 'Review queue' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Enter the review workspace/i })).not.toBeInTheDocument()
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('labelevidence.reviewer-decisions.v1') ?? '{}')).toEqual({}))
  })
})
