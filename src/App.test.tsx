import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LABEL_EVIDENCE_CASES } from './labelEvidence/cases'
import { evaluateImageCase, evaluateUploadedImageCase } from './labelEvidence/imageEvaluation'
import { createRandomizedReviewQueue } from './labelEvidence/reviewQueue'
import type { LabelEvidenceCase, ReviewFlag } from './labelEvidence/types'
import { warmOcrEngine } from './ocr/recognizeLabel'

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
    const checks = flags.length
      ? flags.map((flag) => ({ id: flag.id, label: flag.title, status: 'flagged' as const, detail: flag.detail, expected: flag.applicationValue ?? '', observed: flag.labelValue ?? '' }))
      : [{ id: 'brand', label: 'Brand name', status: 'confirmed' as const, detail: 'The submitted image agrees with the application.', expected: item.application.brandName, observed: item.application.brandName }]
    return {
      caseId: item.id, categoryId: item.category.id, flags, checks,
      reviewedAt: '2026-08-23T12:00:00.000Z', durationMs: 2100, rulesDurationMs: 25, ocrConfidence: 94,
      imageUrl: 'data:image/png;base64,AA==', imageFile: new File(['label'], `${item.id}.png`, { type: 'image/png' }), questions: [],
      outcome: { status: flags.length ? 'needs_review' as const : 'pass' as const, checks: [], ocrText: '', ocrConfidence: 94, durationMs: 2075 },
    }
  }),
  evaluateUploadedImageCase: vi.fn(async (item: LabelEvidenceCase) => ({
    caseId: item.id, categoryId: item.category.id, flags: [],
    checks: [{ id: 'brand', label: 'Brand name', status: 'confirmed' as const, detail: 'The submitted image agrees with the application.', expected: item.application.brandName, observed: item.application.brandName }],
    reviewedAt: '2026-08-23T12:00:00.000Z', durationMs: 2300, rulesDurationMs: 25, ocrConfidence: 94,
    imageUrl: 'data:image/png;base64,AA==', imageFile: new File(['label'], 'upload.png', { type: 'image/png' }), questions: [],
    outcome: { status: 'pass' as const, checks: [], ocrText: '', ocrConfidence: 94, durationMs: 2275 },
  })),
}))

async function enterAndCompleteAnalysis(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: 'Go to LabelEvidence' })[0])
  await user.click(screen.getByRole('button', { name: 'Begin AI analysis' }))
  await waitFor(() => expect(evaluateImageCase).toHaveBeenCalledTimes(56))
}

function queueRow(caseId: string) {
  return screen.getByText(new RegExp(`${caseId} ·`)).closest('[role="row"]') as HTMLElement
}

describe('LabelEvidence queue and human review', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/about')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('explains the application-guided image review before entering the workspace', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /built around the human decision/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How to use LabelEvidence' })).toBeInTheDocument()
    expect(screen.getByText(/To begin the label review process, click/i)).toBeInTheDocument()
    expect(screen.getByText(/Application-guided image review/i)).toBeInTheDocument()
    expect(screen.getByText(/Applicant prescreen/i)).toBeInTheDocument()
    expect(screen.queryByText('Build the review questions')).not.toBeInTheDocument()
    expect(screen.queryByText('Read the actual image')).not.toBeInTheDocument()
    expect(screen.queryByText('Keep the human in control')).not.toBeInTheDocument()
    expect(screen.getByText(/does not connect to TTB systems/i)).toBeInTheDocument()
  })

  it('shows all labels as untouched and waits for the reviewer to begin AI analysis', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Go to LabelEvidence' })[0])
    expect(window.location.pathname).toBe('/queue')
    expect(screen.getAllByText('56').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Not yet evaluated by AI')).toHaveLength(56)
    expect(warmOcrEngine).not.toHaveBeenCalled()
    expect(evaluateImageCase).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Begin AI analysis' }))
    await waitFor(() => expect(evaluateImageCase).toHaveBeenCalledTimes(56))
    expect(screen.getAllByText('Evaluated by AI in 2.10 seconds')).toHaveLength(56)
    expect(screen.queryByRole('dialog', { name: /LabelEvidence found a batch/i })).not.toBeInTheDocument()
  })

  it('keeps queue order across navigation and creates a new order only on reset', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Go to LabelEvidence' })[0])
    const firstSeed = window.localStorage.getItem('labelevidence.randomized-queue-seed.v1')
    const firstCase = document.querySelector('.library-row .case-name small')?.textContent
    await user.click(screen.getByRole('button', { name: 'About' }))
    await user.click(screen.getAllByRole('button', { name: 'Go to LabelEvidence' })[0])
    expect(document.querySelector('.library-row .case-name small')?.textContent).toBe(firstCase)
    expect(window.localStorage.getItem('labelevidence.randomized-queue-seed.v1')).toBe(firstSeed)
    await user.click(screen.getByRole('button', { name: 'Reset all data' }))
    expect(window.location.pathname).toBe('/queue')
    expect(window.localStorage.getItem('labelevidence.randomized-queue-seed.v1')).not.toBe(firstSeed)
  })

  it('shows exact expected and image evidence and saves only after explicit confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterAndCompleteAnalysis(user)
    await user.click(within(queueRow('LE-006')).getByRole('button', { name: 'Review label' }))
    expect(window.location.pathname).toBe('/review/LE-006')
    expect(screen.getAllByText('Blue Meridian Cellars').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 L').length).toBeGreaterThan(0)
    expect(screen.getAllByText('750 mL').length).toBeGreaterThan(0)
    for (const button of screen.getAllByRole('button', { name: 'Confirm concern' })) await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Return for correction' }))
    expect(JSON.parse(window.localStorage.getItem('labelevidence.reviewer-decisions.v3') ?? '{}')['LE-006']?.finalDecision).toBeUndefined()
    await user.click(screen.getByRole('button', { name: /Confirm and proceed to next label/i }))
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('labelevidence.reviewer-decisions.v3') ?? '{}')['LE-006'].finalDecision).toBe('returned'))
  })

  it('lets a reviewer disagree with a passed check and return a label the AI cleared', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterAndCompleteAnalysis(user)
    await user.click(within(queueRow('LE-001')).getByRole('button', { name: 'Review label' }))
    expect(screen.getByRole('heading', { name: 'No AI concerns detected' })).toBeInTheDocument()
    expect(screen.getByText('Brand name')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Disagree' }))
    expect(screen.getByRole('button', { name: 'Approve label' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Return for correction' }))
    expect(screen.getByRole('button', { name: /Confirm and proceed/i })).toBeEnabled()
  })

  it('requires an explanation when returning a clear label without disagreeing with a check', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterAndCompleteAnalysis(user)
    await user.click(within(queueRow('LE-001')).getByRole('button', { name: 'Review label' }))
    await user.click(screen.getByRole('button', { name: 'Return for correction' }))
    const confirm = screen.getByRole('button', { name: /Confirm and proceed/i })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Reviewer note' }), 'The country-of-origin statement is misleading.')
    expect(confirm).toBeEnabled()
  })

  it('introduces a batch only when human review reaches it, then shows the batch overview', async () => {
    const seed = 20260823
    const queue = createRandomizedReviewQueue(LABEL_EVIDENCE_CASES.map((item) => item.id), seed)
    const firstTwoIds = queue.slice(0, 2).flatMap((unit) => unit.caseIds)
    window.localStorage.setItem('labelevidence.randomized-queue-seed.v1', String(seed))
    window.localStorage.setItem('labelevidence.reviewer-decisions.v3', JSON.stringify(Object.fromEntries(firstTwoIds.map((id) => [id, { finalDecision: 'approved', draftDecision: 'approved', decidedAt: '2026-08-23T12:00:00.000Z' }]))))
    const user = userEvent.setup()
    render(<App />)
    await enterAndCompleteAnalysis(user)
    expect(screen.queryByRole('dialog', { name: /LabelEvidence found a batch/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Begin or resume human review' }))
    const notice = screen.getByRole('dialog', { name: /LabelEvidence found a batch of 5 labels/i })
    expect(window.location.pathname).toBe('/review-batch/batch-001')
    await user.click(within(notice).getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: 'Batch overview' })).toBeInTheDocument()
  })

  it('moves completed decisions out of the active queue and allows another review', async () => {
    const user = userEvent.setup()
    render(<App />)
    await enterAndCompleteAnalysis(user)
    await user.click(within(queueRow('LE-001')).getByRole('button', { name: 'Review label' }))
    await user.click(screen.getByRole('button', { name: 'Approve label' }))
    await user.click(screen.getByRole('button', { name: /Confirm and proceed/i }))
    await user.click(screen.getByRole('button', { name: 'Active queue' }))
    expect(screen.queryByText(/LE-001 ·/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Completed reviews' }))
    const completed = screen.getByText(/LE-001 ·/).closest('article') as HTMLElement
    await user.click(within(completed).getByRole('button', { name: 'Review again' }))
    expect(screen.getByRole('button', { name: 'Change saved decision' })).toBeInTheDocument()
  })

  it('offers an editable domestic-spirit applicant prescreen without submitting anything', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Go to LabelEvidence' })[0])
    await user.click(screen.getByRole('button', { name: 'Applicant prescreen' }))
    expect(screen.getByRole('heading', { name: /Prescreen your domestic spirits label/i })).toBeInTheDocument()
    expect(screen.getByText(/does not submit an application/i)).toBeInTheDocument()
    const brand = screen.getByRole('textbox', { name: 'Brand name' })
    expect(brand).toHaveValue('Cedar Ridge Distilling')
    await user.clear(brand)
    await user.type(brand, 'My Test Distillery')
    expect(brand).toHaveValue('My Test Distillery')
    expect(evaluateUploadedImageCase).not.toHaveBeenCalled()
  })
})
