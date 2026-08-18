import type { ChangeEvent, DragEvent } from 'react'
import type { SampleLabel } from '../data/sampleLabels'

type Props = {
  file: File | null
  previewUrl: string | null
  error?: string
  samples: SampleLabel[]
  loadingSample: string | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  onDrop: (event: DragEvent<HTMLLabelElement>) => void | Promise<void>
  onSample: (id: SampleLabel['id']) => void
  onRemove: () => void
}

export function UploadPanel({
  file,
  previewUrl,
  error,
  samples,
  loadingSample,
  onFileChange,
  onDrop,
  onSample,
  onRemove,
}: Props) {
  return (
    <fieldset className="form-panel upload-panel">
      <legend>Label artwork</legend>
      <p className="panel-description">JPEG, PNG, or WebP · 10 MB maximum</p>

      {file && previewUrl ? (
        <div className="image-preview">
          <img src={previewUrl} alt="Selected alcohol label preview" />
          <div>
            <span>{file.name}</span>
            <button type="button" onClick={onRemove}>Remove</button>
          </div>
        </div>
      ) : (
        <label
          className={`drop-zone${error ? ' drop-zone-error' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
        >
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} />
          <span className="upload-symbol" aria-hidden="true">↑</span>
          <strong>Choose a label image</strong>
          <span>or drag and drop it here</span>
        </label>
      )}
      {error && <small className="field-error" role="alert">{error}</small>}

      <div className="sample-section">
        <div className="sample-heading">
          <span>Or try a test case</span>
          <span>Synthetic data</span>
        </div>
        <div className="sample-grid">
          {samples.map((sample) => (
            <button
              type="button"
              className="sample-button"
              key={sample.id}
              onClick={() => onSample(sample.id)}
              disabled={Boolean(loadingSample)}
              title={sample.description}
            >
              <span className={`sample-dot sample-${sample.id}`} aria-hidden="true" />
              <span>
                <strong>{loadingSample === sample.id ? 'Preparing…' : sample.name}</strong>
                <small>{sample.description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
