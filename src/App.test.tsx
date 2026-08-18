import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('explains the local processing boundary', () => {
    render(<App />)

    expect(screen.getByText(/Images stay in this browser/i)).toBeInTheDocument()
    expect(screen.getByText(/Decision-support, not automatic approval/i)).toBeInTheDocument()
  })

  it('requires a label image before review', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Review label/i }))

    expect(screen.getByText(/Upload a label image or choose a sample/i)).toBeInTheDocument()
  })
})
