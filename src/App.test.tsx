import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { LabelEvidenceCase, ReviewFlag } from './labelEvidence/types'

vi.mock('./ocr/recognizeLabel', () => ({ warmOcrEngine: vi.fn().mockResolvedValue(undefined) }))

const FLAGS: Record<string, ReviewFlag[]> = {
  'LE-006': [
    { id: 'brand', kind: 'image_quality', title: 'Brand name could not be verified', detail: 'OCR could not resolve the required brand name.', applicationValue: 'Blue Meridian Cellars', labelValue: 'Not confidently found' },
    { id: 'netContents', kind: 'mismatch', title: 'Net contents may not comply', detail: 'The readable volume conflicts with the application.', applicationValue: '1 L', labelValue: '750 mL' },
  ],
  'LE-007': [{ id: 'warningText', kind: 'image_quality', title: 'Government warning wording could not be verified', detail: 'The required wording was not found.', applicationValue: 'Exact federal warning', labelValue: 'Not found' }],
}

vi.mock('./labelEvidence/imageEvaluation', () => ({
  evaluateImageCase: vi.fn(async (item: LabelEvidenceCase) => {
    const flags = FLAGS[item.id] ?? []
    return {
      caseId: item.id,
      categoryId: item.category.id,
      flags,
      checks: flags.map((flag) => ({ id: flag.id, label: flag.title, status: 'flagged', detail: flag.detail })),
      reviewedAt: '2026-08-22T12:00:00.000Z',
      durationMs: 2100,
      rulesDurationMs: 25,
      ocrConfidence: 94,
      imageUrl: 'data:image/png;base64,AA==',
      imageFile: new File(['label'], `${item.id}.png`, { type: 'image/png' }),
      questions: [],
      outcome: { status: flags.length ? 'needs_review' : 'pass', checks: [], ocrText: '', ocrConfidence: 94, durationMs: 2075 },
    }
  }),
}))

describe('LabelEvidence app', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('explains that application-selected questions guide actual image reading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /built around the human decision/i })).toBeInTheDocument()
    expect(screen.getByText(/The application selects the rules/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /56 image-and-application cases across eight review profiles/i })).toBeInTheDocument()
    expect(screen.getByText('Domestic wine — 7% ABV or higher')).toBeInTheDocument()
    expect(screen.getByText(/does not connect to TTB systems/i)).toBeInTheDocument()
  })

  it('starts with two individuals and then a five-label batch', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Go to LabelEvidence' })[0])
    await screen.findByText('No red flags detected')
    await user.click(screen.getByRole('button', { name: 'Open label review' }))
    await user.click(screen.getByRole('button', { name: 'Approve label' }))
    await user.click(screen.getByRole('button', { name: 'Close label review' }))
    await user.click(screen.getByRole('button', { name: 'Continue to next queue item' }))
    expect(screen.getByRole('heading', { name: 'Queue item 2 of 33' })).toBeInTheDocument()
    expect(screen.getByText(/A batch of 5 labels is next/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open label review' }))
    await user.click(screen.getByRole('button', { name: 'Approve label' }))
    await user.click(screen.getByRole('button', { name: 'Close label review' }))
    await user.click(screen.getByRole('button', { name: 'Continue to next queue item' }))
    expect(screen.getByRole('heading', { name: 'Batch of 5 labels' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Needs human review' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No red flags detected' })).toBeInTheDocument()
  })

  it('keeps every concern separate and saves the human return decision', async () => {
    window.localStorage.setItem('labelevidence.welcome-seen.v1', 'true')
    window.localStorage.setItem('labelevidence.queue-position.v1', '2')
    const user = userEvent.setup()
    render(<App />)
    const row = await screen.findByRole('row', { name: /Blue Meridian Cellars/i })
    await user.click(row)
    expect(screen.getAllByRole('button', { name: 'Confirm concern' })).toHaveLength(2)
    expect(screen.getAllByText('Blue Meridian Cellars').length).toBeGreaterThan(0)
    expect(screen.getByText('1 L')).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: 'Confirm concern' })) await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Return for correction' }))
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('labelevidence.reviewer-decisions.v2') ?? '{}')
      expect(saved['LE-006'].finalDecision).toBe('returned')
    })
  })

  it('requires reviewer attestation before batch-approving clear labels', async () => {
    window.localStorage.setItem('labelevidence.welcome-seen.v1', 'true')
    window.localStorage.setItem('labelevidence.queue-position.v1', '2')
    const user = userEvent.setup()
    render(<App />)
    const group = await screen.findByRole('heading', { name: 'No red flags detected' })
    const section = group.closest('section')!
    const approve = within(section).getByRole('button', { name: 'Approve remaining clear labels' })
    expect(approve).toBeDisabled()
    await user.click(within(section).getByRole('checkbox'))
    expect(approve).toBeEnabled()
    await user.click(approve)
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('labelevidence.reviewer-decisions.v2') ?? '{}')
      expect(saved['LE-003'].finalDecision).toBe('approved')
      expect(saved['LE-004'].note).toMatch(/reviewer-attested/i)
    })
  })

  it('preserves the optional category-balanced batch of 40 and reset stays in the workspace', async () => {
    window.localStorage.setItem('labelevidence.welcome-seen.v1', 'true')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Optional batch of 40' }))
    expect(screen.getByRole('heading', { name: 'Optional batch demonstration' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Batch of 40 labels' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset all data' }))
    expect(screen.getByRole('heading', { name: 'Queue item 1 of 33' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go to LabelEvidence' })).not.toBeInTheDocument()
  })
})
