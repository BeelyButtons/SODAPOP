import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('LabelEvidence app', () => {
  it('explains the evidence-led, human-review purpose', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: /LabelEvidence home/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Review the exceptions/i })).toBeInTheDocument()
    expect(screen.getByText(/system receives no intended answer/i)).toBeInTheDocument()
  })

  it('shows 56 cases across all eight routing profiles', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /56 cases across eight routing profiles/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Domestic wine — 7% ABV or higher' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Imported distilled spirits' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Imported malt beverages' })).toBeInTheDocument()
  })

  it('creates and evaluates a simulated balanced batch of 40', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Create simulated batch of 40/i }))
    expect(screen.getByRole('heading', { name: /Examining label/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: /Batch review complete/i })).toBeInTheDocument(), { timeout: 3000 })
    expect(screen.getByText('Labels evaluated').previousElementSibling).toHaveTextContent('40')
    expect(screen.getByRole('table', { name: /Labels needing human review/i })).toBeInTheDocument()
  })
})
