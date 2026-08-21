import type { ApplicationData } from '../domain/reviewSchema'

type Props = {
  application: ApplicationData
  errors: Partial<Record<keyof ApplicationData, string>>
  onChange: <Key extends keyof ApplicationData>(key: Key, value: ApplicationData[Key]) => void
}

export function ApplicationForm({ application, errors, onChange }: Props) {
  return (
    <fieldset className="form-panel">
      <legend>Application details</legend>
      <p className="panel-description">Values supplied by the COLA application.</p>

      <div className="field-row">
        <label>
          <span>Product type</span>
          <select
            value={application.productType}
            onChange={(event) => onChange('productType', event.target.value as ApplicationData['productType'])}
          >
            <option value="distilled_spirits">Distilled spirits</option>
            <option value="wine">Wine</option>
            <option value="malt_beverage">Malt beverage</option>
          </select>
        </label>

        <label>
          <span>Source</span>
          <select
            value={application.source}
            onChange={(event) => onChange('source', event.target.value as ApplicationData['source'])}
          >
            <option value="domestic">Domestic</option>
            <option value="imported">Imported</option>
          </select>
        </label>
      </div>

      <label>
        <span>Brand name</span>
        <input
          value={application.brandName}
          onChange={(event) => onChange('brandName', event.target.value)}
          aria-invalid={Boolean(errors.brandName)}
          aria-describedby={errors.brandName ? 'brand-error' : undefined}
        />
        {errors.brandName && <small id="brand-error" className="field-error">{errors.brandName}</small>}
      </label>

      <label>
        <span>Class / type</span>
        <input
          value={application.classType}
          onChange={(event) => onChange('classType', event.target.value)}
          aria-invalid={Boolean(errors.classType)}
          aria-describedby={errors.classType ? 'class-error' : undefined}
        />
        {errors.classType && <small id="class-error" className="field-error">{errors.classType}</small>}
      </label>

      <div className="field-row">
        <label>
          <span>Alcohol content</span>
          <input
            value={application.alcoholContent}
            onChange={(event) => onChange('alcoholContent', event.target.value)}
            aria-invalid={Boolean(errors.alcoholContent)}
          />
          {errors.alcoholContent && <small className="field-error">{errors.alcoholContent}</small>}
        </label>
        <label>
          <span>Net contents</span>
          <input
            value={application.netContents}
            onChange={(event) => onChange('netContents', event.target.value)}
            aria-invalid={Boolean(errors.netContents)}
          />
          {errors.netContents && <small className="field-error">{errors.netContents}</small>}
        </label>
      </div>

      <label>
        <span>Container volume (mL)</span>
        <input
          type="number"
          min="1"
          max="100000"
          value={application.containerVolumeMl}
          onChange={(event) => onChange('containerVolumeMl', Number(event.target.value))}
          aria-invalid={Boolean(errors.containerVolumeMl)}
        />
        <small className={errors.containerVolumeMl ? 'field-error' : 'field-hint'}>
          {errors.containerVolumeMl ?? 'Used to determine the warning’s minimum type size.'}
        </small>
      </label>
    </fieldset>
  )
}
