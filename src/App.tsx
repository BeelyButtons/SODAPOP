import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import './App.css'
import { ApplicationForm } from './components/ApplicationForm'
import { ReviewResults } from './components/ReviewResults'
import { ReviewPortal } from './components/ReviewPortal'
import { CompletedReviews } from './components/CompletedReviews'
import { UploadPanel } from './components/UploadPanel'
import { RuleSetReference } from './components/RuleSetReference'
import { SAMPLE_LABELS, createSampleFile } from './data/sampleLabels'
import {
  INITIAL_APPLICATION,
  applicationSchema,
  validateImageFile,
  type ApplicationData,
  type ReviewCheck,
  type ReviewOutcome,
} from './domain/reviewSchema'
import { verifyLabel } from './domain/verifyLabel'
import {
  overrideRuleSet,
  reviewContextFromApplication,
  selectAutomaticRuleSet,
} from './domain/ruleEngine'
import { RULE_SET_SPECIFICATIONS } from './domain/ruleSpecification'
import { recognizeLabel, warmOcrEngine, type OcrProgress } from './ocr/recognizeLabel'
import { appUrl, ruleSetIdFromRoute, useAppRoute, type AppRoute } from './routing'
import {
  appendReviewRecord,
  changeDecisionFromRoute,
  clearQueueProgress,
  completedIdFromRoute,
  currentReviewForSample,
  emptyQueueProgress,
  nextRemainingSample,
  queueIdFromRoute,
  queueSample,
  readQueueProgress,
  reviewHistoryForSample,
  reviewRecordById,
  saveQueueProgress,
  type QueueDecision,
  type QueueProgress,
  type SavedRotation,
  type StaffDecisions,
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
  const [reanalyzingRuleSet, setReanalyzingRuleSet] = useState(false)
  const [queueProgress, setQueueProgress] = useState<QueueProgress>(readQueueProgress)
  const processingQueueCase = useRef<string | null>(null)
  const completedScrollPosition = useRef(0)
  const changeDecisionRoute = changeDecisionFromRoute(route)
  const completedReviewId = completedIdFromRoute(route)
  const activeQueueId = queueIdFromRoute(route)
  const ruleSetReferenceId = ruleSetIdFromRoute(route)
  const ruleSetReference = RULE_SET_SPECIFICATIONS.find((ruleSet) => ruleSet.id === ruleSetReferenceId)
  const activeQueueSample = queueSample(activeQueueId)
  const completedRecord = reviewRecordById(queueProgress, completedReviewId)
  const completedQueueSample = queueSample(completedRecord?.sampleId ?? null)
  const amendmentRecord = reviewRecordById(queueProgress, changeDecisionRoute?.reviewId ?? null)
  const amendmentQueueSample = queueSample(amendmentRecord?.sampleId ?? null)
  const amendmentCheckId = changeDecisionRoute?.checkId
  const completedHistory = completedQueueSample ? reviewHistoryForSample(queueProgress, completedQueueSample.id) : []
  const isCurrentCompletedRecord = Boolean(
    completedRecord && currentReviewForSample(queueProgress, completedRecord.sampleId)?.id === completedRecord.id,
  )

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (import.meta.env.MODE !== 'test') void warmOcrEngine().catch(() => undefined)
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (route === '/results' && !result) navigate('/review', true)
    if (ruleSetReferenceId && !ruleSetReference) navigate('/review', true)
    if (activeQueueId && !activeQueueSample) navigate('/review', true)
    if (completedReviewId && (!completedQueueSample || !completedRecord)) navigate('/review/completed', true)
    if (changeDecisionRoute && (
      !amendmentQueueSample ||
      !amendmentRecord?.result ||
      !amendmentRecord.result.checks.some((check) => check.id === amendmentCheckId)
    )) navigate(amendmentRecord ? `/review/completed/${amendmentRecord.id}` : '/review/completed', true)
    document.title = ruleSetReference
      ? `${ruleSetReference.label} rules · SODAPOP`
      : route === '/review'
      ? 'Review portal · SODAPOP'
      : route === '/review/completed'
        ? 'Completed reviews · SODAPOP'
      : route === '/review/new'
        ? 'New label review · SODAPOP'
        : changeDecisionRoute
          ? 'Change decision · SODAPOP'
        : completedReviewId
          ? 'Completed decision · SODAPOP'
        : 'Review results · SODAPOP'
  }, [activeQueueId, activeQueueSample, amendmentCheckId, amendmentQueueSample, amendmentRecord, changeDecisionRoute, completedQueueSample, completedRecord, completedReviewId, navigate, result, route, ruleSetReference, ruleSetReferenceId])

  useEffect(() => {
    const savedQueueSample = completedQueueSample ?? amendmentQueueSample
    if (!savedQueueSample || file) return
    let cancelled = false
    void createSampleFile(savedQueueSample.id).then((sampleFile) => {
      if (!cancelled) setFile(sampleFile)
    })
    return () => { cancelled = true }
  }, [amendmentQueueSample, completedQueueSample, file])

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
    setQueueProgress(emptyQueueProgress())
  }

  function completeQueueCase(
    decision: QueueDecision,
    staffDecisions: StaffDecisions,
    rotationDegrees: SavedRotation,
  ) {
    const reviewSample = amendmentQueueSample ?? activeQueueSample
    if (!reviewSample) return
    const saved = appendReviewRecord(
      queueProgress,
      reviewSample.id,
      {
        finalDecision: decision,
        staffDecisions,
        result: amendmentRecord?.result ?? result ?? undefined,
        rotationDegrees,
        completedAt: new Date().toISOString(),
      },
      amendmentRecord?.id,
    )
    saveQueueProgress(saved.progress)
    setQueueProgress(saved.progress)
    if (amendmentRecord) {
      setResult(null)
      setFile(null)
      navigate(`/review/completed/${saved.record.id}`)
      return
    }
    const next = nextRemainingSample(saved.progress, reviewSample.id)
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

  function openCompletedReviews() {
    setResult(null)
    setFile(null)
    navigate('/review/completed')
  }

  function openCompletedReview(reviewId: string) {
    completedScrollPosition.current = window.scrollY
    setResult(null)
    setFile(null)
    navigate(`/review/completed/${reviewId}`)
  }

  function returnToCompletedReviews() {
    setResult(null)
    setFile(null)
    navigate('/review/completed')
    window.setTimeout(() => window.scrollTo({ top: completedScrollPosition.current }), 0)
  }

  function changeCompletedDecision(reviewId: string, checkId: ReviewCheck['id']) {
    setResult(null)
    setFile(null)
    setErrors({})
    navigate(`/review/completed/${reviewId}/change/${checkId}`)
  }

  function exitDecisionChange() {
    if (!amendmentRecord) return
    setFile(null)
    navigate(`/review/completed/${amendmentRecord.id}`)
  }

  function reanalyzeWithRuleSet(ruleSetId: string) {
    if (!result || reanalyzingRuleSet) return
    const reviewApplication = result.application ?? application
    const context = reviewContextFromApplication(reviewApplication)
    const previousSelection = result.ruleSelection ?? selectAutomaticRuleSet(context)
    setReanalyzingRuleSet(true)
    window.setTimeout(() => {
      const startedAt = performance.now()
      const selection = overrideRuleSet(previousSelection, context, ruleSetId)
      const nextResult = verifyLabel({
        application: reviewApplication,
        ocrText: result.ocrText,
        ocrConfidence: result.ocrConfidence,
        durationMs: result.durationMs,
        ocrWords: result.ocrWords,
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
        ocrAttempts: result.ocrAttempts,
        ocrRotationDegrees: result.ocrRotationDegrees,
        ruleSelection: selection,
      })
      nextResult.ruleSelection = {
        ...selection,
        reanalysisMs: performance.now() - startedAt,
      }
      setResult(nextResult)
      setReanalyzingRuleSet(false)
    }, 0)
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
          <span className="prototype-badge">Prototype · Rule routing</span>
        </nav>
      </header>

      <main id="top">
        {ruleSetReference && <RuleSetReference ruleSetId={ruleSetReference.id} />}

        {route === '/review' && (
          <ReviewPortal
            progress={queueProgress}
            onStart={startQueue}
            onSelect={openQueueCase}
            onCompleted={openCompletedReviews}
            onReset={resetQueue}
          />
        )}

        {route === '/review/completed' && (
          <CompletedReviews progress={queueProgress} onBack={() => navigate('/review')} onOpen={openCompletedReview} />
        )}

        {completedQueueSample && completedRecord && (
          <>
            <div className="results-page-heading completed-detail-heading">
              <div>
                <p className="eyebrow">Locked completed review</p>
                <h1>{completedQueueSample.name}</h1>
                <p>{completedQueueSample.description}</p>
                <p className="completed-decision-identity">Decision ID {completedRecord.id} · Revision {completedRecord.revision}{completedRecord.completedAt ? ` · ${new Date(completedRecord.completedAt).toLocaleString()}` : ''}</p>
              </div>
              <div className="completed-detail-actions">
                <button className="secondary-button" type="button" onClick={returnToCompletedReviews}>← Completed reviews</button>
              </div>
            </div>
            {completedHistory.length > 1 && (
              <nav className="decision-history" aria-label="Decision revision history">
                <strong>Decision history</strong>
                <div>
                  {completedHistory.map((record) => (
                    <a
                      className={record.id === completedRecord.id ? 'active' : ''}
                      href={appUrl(`/review/completed/${record.id}`)}
                      key={record.id}
                      onClick={(event) => routeLink(event, `/review/completed/${record.id}`)}
                    >
                      Revision {record.revision}: {record.finalDecision === 'pass' ? 'Pass' : 'Fail'}
                    </a>
                  ))}
                </div>
              </nav>
            )}
            {!isCurrentCompletedRecord && (
              <div className="earlier-revision-note" role="status">This is an earlier, read-only revision. Open the latest revision from the decision history to make another change.</div>
            )}
            {completedRecord.result ? (
              previewUrl && file ? (
                <ReviewResults
                  result={completedRecord.result}
                  previewUrl={previewUrl}
                  fileName={file.name}
                  readOnly
                  initialDecisions={completedRecord.staffDecisions}
                  initialRotation={completedRecord.rotationDegrees}
                  recordedDecision={completedRecord.finalDecision}
                  application={completedQueueSample.application}
                  onChangeDecision={isCurrentCompletedRecord ? (checkId) => changeCompletedDecision(completedRecord.id, checkId) : undefined}
                />
              ) : <div className="progress-panel"><strong>Loading saved label artwork…</strong></div>
            ) : (
              <div className="legacy-review-note">
                <h2>Earlier decision: {completedRecord.finalDecision === 'pass' ? 'Pass' : 'Fail'}</h2>
                <p>This decision predates detailed review history, so its individual card decisions cannot be changed.</p>
              </div>
            )}
          </>
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

        {activeQueueSample && !result && (
          <div className="results-page-heading queue-review-heading">
            <div>
              <p className="eyebrow">Queued label review</p>
              <h1>{activeQueueSample.name}</h1>
              <p>{activeQueueSample.description}</p>
            </div>
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
            onFinalDecision={completeQueueCase}
            onPause={pauseQueue}
            reanalyzingRuleSet={reanalyzingRuleSet}
            onRuleSetOverride={reanalyzeWithRuleSet}
            pageContext={{
              eyebrow: 'Queued label review',
              title: activeQueueSample.name,
              description: activeQueueSample.description,
            }}
          />
        )}

        {amendmentQueueSample && amendmentRecord?.result && amendmentCheckId && (
          <>
            <div className="results-page-heading queue-review-heading amendment-heading">
              <div>
                <p className="eyebrow">Changing completed decision</p>
                <h1>{amendmentQueueSample.name}</h1>
                <p>Update the selected card. Previous staff answers remain locked, while unanswered cards remain available if they are needed for a final Pass.</p>
              </div>
            </div>
            {previewUrl && file ? (
              <ReviewResults
                result={amendmentRecord.result}
                previewUrl={previewUrl}
                fileName={file.name}
                initialDecisions={amendmentRecord.staffDecisions}
                initialRotation={amendmentRecord.rotationDegrees}
                recordedDecision={amendmentRecord.finalDecision}
                amendmentCheckId={amendmentCheckId}
                onFinalDecision={completeQueueCase}
                onPause={exitDecisionChange}
                pauseLabel="Exit decision change"
                application={amendmentQueueSample.application}
              />
            ) : <div className="progress-panel"><strong>Loading saved label artwork…</strong></div>}
          </>
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
            <ReviewResults
              result={result}
              previewUrl={previewUrl}
              fileName={file.name}
              reanalyzingRuleSet={reanalyzingRuleSet}
              onRuleSetOverride={reanalyzeWithRuleSet}
            />
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
