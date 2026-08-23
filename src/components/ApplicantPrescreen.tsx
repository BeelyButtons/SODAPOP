import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { ROUTING_CATEGORIES } from '../labelEvidence/cases'
import { evaluateUploadedImageCase, type ImageCaseEvaluation } from '../labelEvidence/imageEvaluation'
import type { ApplicationRecord, EvidenceRecord, LabelEvidenceCase } from '../labelEvidence/types'
import { sanitizeUploadedLabel } from '../labelEvidence/uploadSecurity'
import { warmOcrEngine, type OcrProgress } from '../ocr/recognizeLabel'

interface ApplicantForm {
  brandName: string
  classType: string
  alcoholContent: string
  netContents: string
  responsibleParty: string
  ingredients: string
  ageYears: string
  formulaRequired: boolean
  formulaId: string
  formulaInstructions: string
}

const DEFAULT_FORM: ApplicantForm = {
  brandName: 'Cedar Ridge Distilling',
  classType: 'Straight Bourbon Whiskey',
  alcoholContent: '45% Alc./Vol. (90 Proof)',
  netContents: '750 mL',
  responsibleParty: 'Bottled by Cedar Ridge Distilling, Louisville, KY',
  ingredients: 'Corn, rye, malted barley, water',
  ageYears: '4',
  formulaRequired: false,
  formulaId: '',
  formulaInstructions: '',
}

function buildApplicantCase(form: ApplicantForm): LabelEvidenceCase {
  const category = ROUTING_CATEGORIES.find((item) => item.id === 'spirits-domestic')!
  const application: ApplicationRecord = {
    id: 'APPLICANT-PRESCREEN', categoryId: category.id, commodity: 'distilled_spirits', source: 'domestic', wineAbvBand: 'not_applicable',
    brandName: form.brandName.trim(), classType: form.classType.trim(), alcoholContent: form.alcoholContent.trim(), netContents: form.netContents.trim(),
    responsibleParty: form.responsibleParty.trim(), sulfitesPpm: 0,
    ingredients: form.ingredients.split(',').map((value) => value.trim()).filter(Boolean),
    formula: form.formulaRequired
      ? { required: true, status: form.formulaId.trim() ? 'approved' : 'missing', id: form.formulaId.trim() || undefined, labelingInstructions: form.formulaInstructions.trim() || undefined }
      : { required: false, status: 'not_required' },
    ageYears: form.ageYears.trim() ? Number(form.ageYears) : undefined,
  }
  const evidence: EvidenceRecord[] = form.formulaRequired ? [{ id: 'applicant-formula', type: 'formula', title: 'Formula record', status: form.formulaId.trim() ? 'available' : 'missing', supports: [form.formulaInstructions.trim()].filter(Boolean) }] : []
  return {
    id: 'APPLICANT-PRESCREEN', displayName: form.brandName.trim() || 'Applicant label', category, application, evidence,
    label: { declarations: [], warning: { present: false, exactText: false, headingCapitalized: false, headingBold: false, minimumTypeSizeMet: false, contrastMet: false }, claims: [], imageQuality: 'clear', difficultAreas: [] },
  }
}

function validateForm(form: ApplicantForm) {
  const fields: Array<[string, string, number]> = [
    ['Brand name', form.brandName, 120], ['Class or type', form.classType, 180], ['Alcohol content', form.alcoholContent, 80],
    ['Net contents', form.netContents, 50], ['Responsible party', form.responsibleParty, 220], ['Ingredients', form.ingredients, 500],
  ]
  for (const [label, value, maximum] of fields) {
    if (!value.trim()) return `${label} is required.`
    if (value.length > maximum) return `${label} is longer than the ${maximum}-character prototype limit.`
    if (/\p{Cc}/u.test(value)) return `${label} contains unsupported control characters.`
  }
  if (form.ageYears && (!Number.isInteger(Number(form.ageYears)) || Number(form.ageYears) < 0 || Number(form.ageYears) > 100)) return 'Age must be a whole number from 0 through 100.'
  if (form.formulaRequired && !form.formulaId.trim()) return 'Enter the approved formula ID or turn off “Formula required.”'
  return undefined
}

function duration(milliseconds: number) {
  return milliseconds < 1000 ? `${Math.max(1, Math.round(milliseconds))} ms` : `${(milliseconds / 1000).toFixed(2)} seconds`
}

export function ApplicantPrescreen() {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [formError, setFormError] = useState('')
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [evaluation, setEvaluation] = useState<ImageCaseEvaluation | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const applicantCase = useMemo(() => buildApplicantCase(form), [form])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])
  useEffect(() => () => { if (evaluation?.imageUrl) URL.revokeObjectURL(evaluation.imageUrl) }, [evaluation])

  function update<K extends keyof ApplicantForm>(key: K, value: ApplicantForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setEvaluation(null)
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    setUploadError('')
    setEvaluation(null)
    try {
      const safeFile = await sanitizeUploadedLabel(selected)
      setFile(safeFile)
      setFileName(selected.name.slice(0, 120))
      setPreviewUrl(URL.createObjectURL(safeFile))
    } catch (error) {
      setFile(null)
      setFileName('')
      setPreviewUrl('')
      setUploadError(error instanceof Error ? error.message : 'The image was rejected.')
    }
  }

  async function analyze() {
    const error = validateForm(form)
    if (error) { setFormError(error); return }
    if (!file) { setUploadError('Choose a PNG or JPEG label image before starting the prescreen.'); return }
    setFormError('')
    setUploadError('')
    setAnalyzing(true)
    setProgress({ progress: 1, message: 'Preparing domestic distilled spirits requirements' })
    try {
      await warmOcrEngine()
      const result = await evaluateUploadedImageCase(applicantCase, file, setProgress)
      setEvaluation(result)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'The prescreen could not finish.')
    } finally {
      setAnalyzing(false)
      setProgress(null)
    }
  }

  return <main className="prescreen-page">
    <section className="prescreen-hero"><div><p className="eyebrow">Applicant-facing possibility</p><h1>Prescreen your domestic spirits label</h1><p>This page demonstrates how LabelEvidence could be extended to applicants. It can identify potential omissions or conflicts before submission, giving an applicant an opportunity to make adjustments instead of waiting to learn that a label may be noncompliant.</p></div><aside><strong>Demonstration only</strong><p>This does not submit an application, issue a COLA, guarantee approval, or replace an official TTB review.</p></aside></section>
    <section className="prescreen-security"><strong>Your image stays in this browser.</strong><span>Only genuine PNG and JPEG files are accepted. Files are size- and dimension-limited, checked by their internal signature, decoded as images, and re-encoded before OCR. SVG, PDF, executable, renamed, and unsupported files are rejected.</span></section>
    <div className="prescreen-grid"><section className="prescreen-form"><div className="section-heading"><p className="eyebrow">Application information</p><h2>Domestic distilled spirits</h2><p>These demonstration values are pre-filled. Change them to match the label you want to test.</p></div>
      <div className="field-grid"><label>Brand name<input value={form.brandName} maxLength={120} onChange={(event) => update('brandName', event.target.value)} /></label><label>Class or type<input value={form.classType} maxLength={180} onChange={(event) => update('classType', event.target.value)} /></label><label>Alcohol content<input value={form.alcoholContent} maxLength={80} onChange={(event) => update('alcoholContent', event.target.value)} /></label><label>Net contents<input value={form.netContents} maxLength={50} onChange={(event) => update('netContents', event.target.value)} /></label><label className="wide-field">Responsible party and address<input value={form.responsibleParty} maxLength={220} onChange={(event) => update('responsibleParty', event.target.value)} /></label><label className="wide-field">Ingredients<input value={form.ingredients} maxLength={500} onChange={(event) => update('ingredients', event.target.value)} /></label><label>Age in years<input type="number" min="0" max="100" value={form.ageYears} onChange={(event) => update('ageYears', event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={form.formulaRequired} onChange={(event) => update('formulaRequired', event.target.checked)} />Formula required</label>{form.formulaRequired && <><label>Approved formula ID<input value={form.formulaId} maxLength={80} onChange={(event) => update('formulaId', event.target.value)} /></label><label className="wide-field">Formula labeling instructions<input value={form.formulaInstructions} maxLength={500} onChange={(event) => update('formulaInstructions', event.target.value)} /></label></>}</div>
      <div className="upload-field"><p className="eyebrow">Label artwork</p>{previewUrl ? <div className="secure-preview"><img src={previewUrl} alt="Selected applicant label" /><div><strong>{fileName}</strong><span>Validated and safely re-encoded as PNG</span><button type="button" onClick={() => { setFile(null); setFileName(''); setPreviewUrl(''); setEvaluation(null) }}>Remove image</button></div></div> : <label className={uploadError ? 'secure-drop error' : 'secure-drop'}><input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={chooseFile} /><span aria-hidden="true">↑</span><strong>Choose a PNG or JPEG label image</strong><small>10 MB maximum · 300 × 300 minimum</small></label>}{uploadError && <p className="form-alert" role="alert">{uploadError}</p>}</div>
      {formError && <p className="form-alert" role="alert">{formError}</p>}<button className="primary-button prescreen-submit" type="button" disabled={analyzing} onClick={analyze}>{analyzing ? `${progress?.message ?? 'Analyzing image'} · ${progress?.progress ?? 0}%` : 'Prescreen this label'}</button>
    </section>
    <section className="prescreen-results" aria-live="polite"><div className="section-heading"><p className="eyebrow">Prescreen result</p><h2>{evaluation ? evaluation.flags.length ? `${evaluation.flags.length} potential concern${evaluation.flags.length === 1 ? '' : 's'}` : 'No potential concerns detected' : 'Ready when you are'}</h2><p>{evaluation ? `OCR confidence ${Math.round(evaluation.ocrConfidence)}% · completed in ${duration(evaluation.durationMs)}` : 'LabelEvidence will compare the image with the editable application information and domestic distilled spirits requirements.'}</p></div>
      {!evaluation ? <div className="prescreen-empty"><span aria-hidden="true">LE</span><p>Your advisory results will appear here. Nothing is transmitted or saved as a regulatory submission.</p></div> : <><img className="prescreen-result-image" src={evaluation.imageUrl} alt="Normalized label used for applicant prescreen" />{evaluation.flags.length ? <div className="applicant-concerns">{evaluation.flags.map((flag) => <article key={flag.id}><strong>{flag.title}</strong><p>{flag.detail}</p>{flag.applicationValue && <span><b>Application</b>{flag.applicationValue}</span>}{flag.labelValue && <span><b>Image evidence</b>{flag.labelValue}</span>}</article>)}</div> : <div className="applicant-clear"><strong>No potential issues were detected in this prototype review.</strong><p>An official reviewer may identify other requirements or concerns.</p></div>}<details className="applicant-checks"><summary>View all {evaluation.checks.length} prescreen checks</summary>{evaluation.checks.map((check) => <article key={check.id}><span className={check.status === 'confirmed' ? 'check-pass' : 'check-flag'}>{check.status === 'confirmed' ? 'Verified' : 'Review'}</span><strong>{check.label}</strong><p><b>Expected</b>{check.expected}</p><p><b>Image evidence</b>{check.observed}</p><small>{check.detail}</small></article>)}</details></>}
    </section></div>
  </main>
}
