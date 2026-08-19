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
    expect(screen.getByLabelText(/9 labels remaining/i)).toBeInTheDocument()
  })
})
