import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import './App.css'
import { ApplicationForm } from './components/ApplicationForm'
import { ReviewResults } from './components/ReviewResults'
import { ReviewPortal } from './components/ReviewPortal'
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
import { appUrl, useAppRoute, type AppRoute } from './routing'
import {
  clearQueueProgress,
  nextRemainingSample,
  queueIdFromRoute,
  queueSample,
  readQueueProgress,
  saveQueueProgress,
  type QueueDecision,
  type QueueProgress,
} from './reviewQueue'

type FormErrors = Partial<Record<keyof ApplicationData | 'file' | 'form', string>>

function App() {
  const { route, navigate } = useAppRoute()
  const [application, setApplication] = useState<ApplicationData>(INITIAL_APPLICATION)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [result, setResult] = useState<ReviewOutcome | null>(null)
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const [queueProgress, setQueueProgress] = useState<QueueProgress>(readQueueProgress)
  const processingQueueCase = useRef<string | null>(null)
  const activeQueueId = queueIdFromRoute(route)
  const activeQueueSample = queueSample(activeQueueId)

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (route === '/results' && !result) navigate('/review', true)
    if (activeQueueId && !activeQueueSample) navigate('/review', true)
    document.title = route === '/review'
      ? 'Review portal · SODAPOP'
      : route === '/review/new'
        ? 'New label review · SODAPOP'
        : 'Review results · SODAPOP'
  }, [activeQueueId, activeQueueSample, navigate, result, route])

  useEffect(() => {
    if (!activeQueueSample || result || processingQueueCase.current === activeQueueSample.id) return
    const sample = activeQueueSample
    processingQueueCase.current = sample.id
    let cancelled = false

    async function processQueueCase() {
      setLoadingSample(sample.id)
      setErrors({})
      setProgress({ progress: 1, message: 'Preparing queued label' })
      try {
        const sampleFile = await createSampleFile(sample.id)
        if (cancelled) return
        setApplication({ ...sample.application })
        setFile(sampleFile)
        const ocr = await recognizeLabel(sampleFile, sample.application, setProgress)
        if (cancelled) return
        setResult(verifyLabel({
          application: sample.application,
          ocrText: ocr.text,
          ocrConfidence: ocr.confidence,
          durationMs: ocr.durationMs,
          ocrWords: ocr.words,
          imageWidth: ocr.imageWidth,
          imageHeight: ocr.imageHeight,
          ocrAttempts: ocr.attempts,
          ocrRotationDegrees: (ocr.rotationRadians * 180) / Math.PI,
        }))
      } catch (error) {
        if (!cancelled) {
          setErrors({ form: error instanceof Error ? error.message : 'The queued label could not be processed.' })
        }
      } finally {
        if (!cancelled) {
          setProgress(null)
          setLoadingSample(null)
          processingQueueCase.current = null
        }
      }
    }

    void processQueueCase()
    return () => {
      cancelled = true
      if (processingQueueCase.current === sample.id) processingQueueCase.current = null
    }
  }, [activeQueueSample, result])

  function routeLink(event: MouseEvent<HTMLAnchorElement>, nextRoute: AppRoute) {
    event.preventDefault()
    navigate(nextRoute)
  }

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
      const ocr = await recognizeLabel(parsedFile.data, parsedApplication.data, setProgress)
      const nextResult = verifyLabel({
          application: parsedApplication.data,
          ocrText: ocr.text,
          ocrConfidence: ocr.confidence,
          durationMs: ocr.durationMs,
          ocrWords: ocr.words,
          imageWidth: ocr.imageWidth,
          imageHeight: ocr.imageHeight,
          ocrAttempts: ocr.attempts,
          ocrRotationDegrees: (ocr.rotationRadians * 180) / Math.PI,
        })
      setResult(nextResult)
      navigate('/results')
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

  function openQueueCase(id: (typeof SAMPLE_LABELS)[number]['id']) {
    setResult(null)
    setFile(null)
    setErrors({})
    navigate(`/review/${id}`)
  }

  function startQueue() {
    const next = nextRemainingSample(queueProgress)
    if (next) openQueueCase(next.id)
  }

  function resetQueue() {
    clearQueueProgress()
    setQueueProgress({})
  }

  function completeQueueCase(decision: QueueDecision) {
    if (!activeQueueSample) return
    const updated = { ...queueProgress, [activeQueueSample.id]: decision }
    saveQueueProgress(updated)
    setQueueProgress(updated)
    const next = nextRemainingSample(updated, activeQueueSample.id)
    setResult(null)
    setFile(null)
    if (next) navigate(`/review/${next.id}`)
    else navigate('/review')
  }

  function pauseQueue() {
    processingQueueCase.current = null
    setProgress(null)
    setResult(null)
    setFile(null)
    navigate('/review')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="wordmark"
          href={appUrl('/review')}
          aria-label="SODAPOP review page"
          onClick={(event) => routeLink(event, '/review')}
        >
          <span className="wordmark-mark" aria-hidden="true">SP</span>
          <span>SODAPOP</span>
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          <a
            className={route === '/review' ? 'active' : ''}
            href={appUrl('/review')}
            onClick={(event) => routeLink(event, '/review')}
          >
            Review queue
          </a>
          <a
            className={route === '/review/new' ? 'active' : ''}
            href={appUrl('/review/new')}
            onClick={(event) => routeLink(event, '/review/new')}
          >
            New label
          </a>
          {result && !activeQueueSample && (
            <a
              className={route === '/results' ? 'active' : ''}
              href={appUrl('/results')}
              onClick={(event) => routeLink(event, '/results')}
            >
              Results
            </a>
          )}
          <span className="prototype-badge">Prototype · Distilled spirits</span>
        </nav>
      </header>

      <main id="top">
        {route === '/review' && (
          <ReviewPortal progress={queueProgress} onStart={startQueue} onSelect={openQueueCase} onReset={resetQueue} />
        )}

        {route === '/review/new' && <section className="workspace workspace-new" aria-label="Single-label review workspace">
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
        </section>}

        {activeQueueSample && (
          <div className="results-page-heading queue-review-heading">
            <div>
              <p className="eyebrow">Queued label review</p>
              <h1>{activeQueueSample.name}</h1>
              <p>{activeQueueSample.description}</p>
            </div>
            <button className="secondary-button" type="button" onClick={pauseQueue}>
              Pause review
            </button>
          </div>
        )}

        {activeQueueSample && progress && (
          <div className="progress-panel queue-progress" role="status" aria-live="polite">
            <div><strong>{progress.message}</strong><span>{progress.progress}%</span></div>
            <progress value={progress.progress} max="100" />
            <p>SODAPOP is processing this label locally.</p>
          </div>
        )}

        {activeQueueSample && errors.form && <div className="form-alert" role="alert">{errors.form}</div>}

        {activeQueueSample && result && previewUrl && file && (
          <ReviewResults
            result={result}
            previewUrl={previewUrl}
            fileName={file.name}
            queueMode
            onFinalDecision={completeQueueCase}
          />
        )}

        {route === '/results' && result && previewUrl && file && (
          <>
            <div className="results-page-heading">
              <div>
                <p className="eyebrow">Single-label review</p>
                <h1>Review results</h1>
              </div>
              <button className="secondary-button" type="button" onClick={() => navigate('/review/new')}>
                ← Back to application
              </button>
            </div>
            <ReviewResults result={result} previewUrl={previewUrl} fileName={file.name} />
          </>
        )}

        <div className="trust-notes">
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
          <section className="privacy-card" aria-labelledby="privacy-title">
            <span className="privacy-icon" aria-hidden="true">✓</span>
            <div>
              <h2 id="privacy-title">Private by design</h2>
              <p>Images are never uploaded. Demonstration-queue progress is saved only in this browser and can be reset.</p>
            </div>
          </section>
        </div>
      </main>

      <footer>
        <span>SODAPOP prototype</span>
        <span>Local processing · Browser-only queue progress</span>
      </footer>
    </div>
  )
}

export default App
