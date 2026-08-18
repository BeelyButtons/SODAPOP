import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import './App.css'
import { ApplicationForm } from './components/ApplicationForm'
import { ReviewResults } from './components/ReviewResults'
import { UploadPanel } from './components/UploadPanel'
import { SAMPLE_LABELS, createSampleFile } from './data/sampleLabels'
import {
  INITIAL_APPLICATION,
  applicationSchema,
  validateImageFile,
  type ApplicationData,
  type ReviewOutcome,
} from './domain/reviewSchema'
import { verifyLabel } from './domain/verifyLabel'
import { recognizeLabel, type OcrProgress } from './ocr/recognizeLabel'

type FormErrors = Partial<Record<keyof ApplicationData | 'file' | 'form', string>>

function App() {
  const [application, setApplication] = useState<ApplicationData>(INITIAL_APPLICATION)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [result, setResult] = useState<ReviewOutcome | null>(null)
  const [loadingSample, setLoadingSample] = useState<string | null>(null)

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function updateField<Key extends keyof ApplicationData>(key: Key, value: ApplicationData[Key]) {
    setApplication((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
    setResult(null)
  }

  async function acceptFile(nextFile: File | null) {
    if (!nextFile) return
    const parsed = await validateImageFile(nextFile)
    if (!parsed.success) {
      setErrors((current) => ({ ...current, file: parsed.error }))
      return
    }
    setFile(nextFile)
    setErrors((current) => ({ ...current, file: undefined, form: undefined }))
    setResult(null)
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    await acceptFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  async function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    await acceptFile(event.dataTransfer.files?.[0] ?? null)
  }

  async function loadSample(sampleId: (typeof SAMPLE_LABELS)[number]['id']) {
    const sample = SAMPLE_LABELS.find((candidate) => candidate.id === sampleId)
    if (!sample) return
    setLoadingSample(sampleId)
    try {
      const sampleFile = await createSampleFile(sampleId)
      setApplication({ ...sample.application })
      setFile(sampleFile)
      setErrors({})
      setResult(null)
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'The sample could not be loaded.' })
    } finally {
      setLoadingSample(null)
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault()
    if (progress) return

    const nextErrors: FormErrors = {}
    const parsedApplication = applicationSchema.safeParse(application)
    if (!parsedApplication.success) {
      for (const issue of parsedApplication.error.issues) {
        const field = issue.path[0] as keyof ApplicationData
        nextErrors[field] ??= issue.message
      }
    }
    const parsedFile = file ? await validateImageFile(file) : null
    if (!file) nextErrors.file = 'Upload a label image or choose a sample.'
    else if (parsedFile && !parsedFile.success) nextErrors.file = parsedFile.error

    if (!parsedApplication.success || !parsedFile?.success) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setResult(null)
    setProgress({ progress: 1, message: 'Starting local review' })
    try {
      const ocr = await recognizeLabel(parsedFile.data, setProgress)
      setResult(
        verifyLabel({
          application: parsedApplication.data,
          ocrText: ocr.text,
          ocrConfidence: ocr.confidence,
          durationMs: ocr.durationMs,
        }),
      )
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? `The label could not be processed: ${error.message}`
            : 'The label could not be processed. Try a clearer image.',
      })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="LabelCheck home">
          <span className="wordmark-mark" aria-hidden="true">LC</span>
          <span>LabelCheck</span>
        </a>
        <span className="prototype-badge">Prototype · Distilled spirits</span>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">AI-assisted label verification</p>
            <h1 id="page-title">Review the label.<br />Keep the judgment.</h1>
            <p className="hero-copy">
              Compare application details with label artwork in seconds. Every result includes
              evidence and clearly identifies what still needs a human decision.
            </p>
          </div>
          <div className="privacy-card">
            <span className="privacy-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Private by design</strong>
              <p>Images stay in this browser. No uploads, accounts, or stored review data.</p>
            </div>
          </div>
        </section>

        <section className="workspace" aria-label="Single-label review workspace">
          <div className="workspace-heading">
            <div>
              <span className="step-number">1</span>
              <div>
                <h2>Start a single-label review</h2>
                <p>Enter the application values, then add the matching label artwork.</p>
              </div>
            </div>
            <span className="required-note">All fields required</span>
          </div>

          <form onSubmit={submitReview} noValidate>
            <div className="review-grid">
              <ApplicationForm application={application} errors={errors} onChange={updateField} />
              <UploadPanel
                file={file}
                previewUrl={previewUrl}
                error={errors.file}
                samples={SAMPLE_LABELS}
                loadingSample={loadingSample}
                onFileChange={onFileChange}
                onDrop={onDrop}
                onSample={loadSample}
                onRemove={() => {
                  setFile(null)
                  setResult(null)
                }}
              />
            </div>

            {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

            <div className="submit-row">
              <div className="local-note">
                <span aria-hidden="true">◉</span>
                OCR runs locally after a one-time model load.
              </div>
              <button className="primary-button" type="submit" disabled={Boolean(progress)}>
                {progress ? 'Reviewing label…' : 'Review label'}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            {progress && (
              <div className="progress-panel" role="status" aria-live="polite">
                <div>
                  <strong>{progress.message}</strong>
                  <span>{progress.progress}%</span>
                </div>
                <progress value={progress.progress} max="100" />
                <p>The first review loads the OCR model; later reviews are faster.</p>
              </div>
            )}
          </form>
        </section>

        {result && <ReviewResults result={result} />}

        <section className="boundary-note" aria-labelledby="boundary-title">
          <span aria-hidden="true">i</span>
          <div>
            <h2 id="boundary-title">Decision-support, not automatic approval</h2>
            <p>
              This prototype flags discrepancies and uncertain evidence. A qualified reviewer
              remains responsible for the final regulatory decision.
            </p>
          </div>
        </section>
      </main>

      <footer>
        <span>LabelCheck prototype</span>
        <span>Local processing · No data retention</span>
      </footer>
    </div>
  )
}

export default App
