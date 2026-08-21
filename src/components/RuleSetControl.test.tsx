import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { reviewContextFromApplication, selectAutomaticRuleSet } from '../domain/ruleEngine'
import { INITIAL_APPLICATION } from '../domain/reviewSchema'
import { RuleSetControl } from './RuleSetControl'

describe('RuleSetControl', () => {
  const context = reviewContextFromApplication(INITIAL_APPLICATION)
  const selection = selectAutomaticRuleSet(context, '2026-08-20T00:00:00.000Z')

  it('explains the selected rule set and opens a persistent reference route', async () => {
    const user = userEvent.setup()
    render(<RuleSetControl selection={selection} context={context} />)

    await user.click(screen.getByRole('button', { name: /Rules: Distilled spirits — Domestic/i }))

    expect(screen.getByText('Automatically selected')).toBeInTheDocument()
    expect(screen.getByText('Source: Domestic')).toBeInTheDocument()
    const hiddenRules = screen.getByText(/Show 13 rules that do not apply/i).closest('details')
    expect(hiddenRules).not.toHaveAttribute('open')
    const fullReference = screen.getByRole('link', { name: /Open full rule set/i })
    expect(fullReference).toHaveAttribute('href', '/rules/distilled-spirits-domestic')
    expect(fullReference).toHaveAttribute('target', '_blank')
  })

  it('loads ranked alternatives only after opening and confirms an override', async () => {
    const user = userEvent.setup()
    const onOverride = vi.fn()
    render(
      <RuleSetControl
        selection={selection}
        context={context}
        onOverride={onOverride}
      />,
    )

    expect(screen.queryByText(/Likely alternative 1/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Rules: Distilled spirits — Domestic/i }))
    expect(screen.getByText(/Likely alternative 1/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: /Alternate rule set/i }), 'malt-beverage-domestic')
    expect(screen.getByRole('heading', { name: /Malt beverage — Domestic/i })).toBeInTheDocument()
    expect(screen.getByText(/Application conflict: Application product type is distilled spirits/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Apply rule set and reanalyze/i }))
    expect(onOverride).toHaveBeenCalledWith('malt-beverage-domestic')
  })

  it('does not offer changes for a read-only completed review', async () => {
    const user = userEvent.setup()
    render(<RuleSetControl selection={selection} context={context} readOnly />)
    await user.click(screen.getByRole('button', { name: /Rules: Distilled spirits — Domestic/i }))
    expect(screen.queryByRole('heading', { name: /Change the rule set/i })).not.toBeInTheDocument()
  })

  it('discloses when an override reused cached evidence', async () => {
    const user = userEvent.setup()
    render(
      <RuleSetControl
        selection={{ ...selection, reanalysisMs: 2.4 }}
        context={context}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Rules: Distilled spirits — Domestic/i }))
    expect(screen.getByText(/Cached reanalysis: <10 ms · no OCR rerun/i)).toBeInTheDocument()
  })

  it('closes by Escape or backdrop and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<RuleSetControl selection={selection} context={context} />)
    const trigger = screen.getByRole('button', { name: /Rules: Distilled spirits — Domestic/i })

    await user.click(trigger)
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())

    await user.click(trigger)
    fireEvent.mouseDown(document.querySelector('.rule-set-backdrop')!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })
})
