import type { CaseEvaluation, LabelEvidenceCase, ReviewCheckResult, ReviewFlag } from './types'

function normalize(value: string | undefined) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? ''
}

function compareField(
  flags: ReviewFlag[],
  checks: ReviewCheckResult[],
  id: string,
  label: string,
  applicationValue: string | undefined,
  labelValue: string | undefined,
) {
  if (!labelValue) {
    flags.push({ id, kind: 'missing', title: `${label} could not be found`, detail: `The application lists “${applicationValue},” but LabelEvidence did not find it on the label.`, applicationValue })
    checks.push({ id, label, status: 'flagged', detail: 'Not found on the label' })
    return
  }
  if (normalize(applicationValue) !== normalize(labelValue)) {
    flags.push({ id, kind: 'mismatch', title: `${label} may not match`, detail: `The application and label contain different ${label.toLowerCase()} information.`, applicationValue, labelValue })
    checks.push({ id, label, status: 'flagged', detail: `Application: ${applicationValue} · Label: ${labelValue}` })
    return
  }
  checks.push({ id, label, status: 'confirmed', detail: `Matches “${applicationValue}”` })
}

export function evaluateCase(item: LabelEvidenceCase): CaseEvaluation {
  const flags: ReviewFlag[] = []
  const checks: ReviewCheckResult[] = []
  const { application, label } = item

  compareField(flags, checks, 'brand-name', 'Brand name', application.brandName, label.brandName)
  compareField(flags, checks, 'class-type', 'Class or type', application.classType, label.classType)
  compareField(flags, checks, 'alcohol-content', 'Alcohol content', application.alcoholContent, label.alcoholContent)
  compareField(flags, checks, 'net-contents', 'Net contents', application.netContents, label.netContents)
  compareField(flags, checks, 'responsible-party', 'Responsible party', application.responsibleParty, label.responsibleParty)
  if (application.source === 'imported') compareField(flags, checks, 'country-origin', 'Country of origin', application.countryOrigin, label.countryOrigin)

  if (application.formula.required) {
    const formulaEvidence = item.evidence.find((record) => record.type === 'formula' && record.status === 'available')
    if (application.formula.status !== 'approved' || !formulaEvidence) {
      flags.push({ id: 'formula-evidence', kind: 'evidence', title: 'Formula approval could not be verified', detail: 'This application indicates that formula approval is required, but an approved formula record was not available.' })
      checks.push({ id: 'formula-evidence', label: 'Formula approval', status: 'flagged', detail: 'Required evidence is unavailable' })
    } else checks.push({ id: 'formula-evidence', label: 'Formula approval', status: 'confirmed', detail: `${application.formula.id} is available` })
  }

  if (application.ageOriginEvidenceRequired) {
    const ageEvidence = item.evidence.find((record) => record.type === 'age_origin' && record.status === 'available')
    if (!ageEvidence) {
      flags.push({ id: 'age-origin-evidence', kind: 'evidence', title: 'Age and origin evidence is missing', detail: 'The product facts require an age/origin record, but the case file does not contain an available record.' })
      checks.push({ id: 'age-origin-evidence', label: 'Age and origin evidence', status: 'flagged', detail: 'Required evidence is unavailable' })
    } else checks.push({ id: 'age-origin-evidence', label: 'Age and origin evidence', status: 'confirmed', detail: ageEvidence.title })
  }

  if (application.sulfitesPpm >= 10) {
    const hasDeclaration = label.declarations.some((value) => normalize(value).includes('contains sulfites'))
    if (!hasDeclaration) {
      flags.push({ id: 'sulfites', kind: 'missing', title: 'Sulfite declaration may be missing', detail: `The product record reports ${application.sulfitesPpm} ppm sulfites, but a “Contains Sulfites” declaration was not found.` })
      checks.push({ id: 'sulfites', label: 'Sulfite declaration', status: 'flagged', detail: 'Not found' })
    } else checks.push({ id: 'sulfites', label: 'Sulfite declaration', status: 'confirmed', detail: 'Found on the label' })
  }

  const warningProblems: string[] = []
  if (!label.warning.present) warningProblems.push('the warning was not found')
  else {
    if (!label.warning.exactText) warningProblems.push('the wording may differ from the required statement')
    if (!label.warning.headingCapitalized) warningProblems.push('the heading is not fully capitalized')
    if (!label.warning.headingBold) warningProblems.push('the heading does not appear bold')
    if (!label.warning.minimumTypeSizeMet) warningProblems.push('the minimum type size may not be met')
    if (!label.warning.contrastMet) warningProblems.push('the text may not contrast sufficiently with its background')
  }
  if (warningProblems.length) {
    flags.push({ id: 'government-warning', kind: 'warning', title: 'Government warning needs review', detail: warningProblems.join('; ') })
    checks.push({ id: 'government-warning', label: 'Government warning', status: 'flagged', detail: warningProblems.join('; ') })
  } else checks.push({ id: 'government-warning', label: 'Government warning', status: 'confirmed', detail: 'Required wording and presentation checks passed' })

  for (const [index, claim] of label.claims.entries()) {
    const evidence = item.evidence.find((record) => record.status === 'available' && record.supports.some((support) => normalize(support).includes(claim.type)))
    const prohibited = claim.type === 'health'
    flags.push({
      id: `claim-${index}`,
      kind: prohibited ? 'prohibited_claim' : 'claim',
      title: prohibited ? 'Questionable health claim detected' : 'Additional label claim needs review',
      detail: prohibited
        ? `“${claim.text}” may make an impermissible or misleading health representation.`
        : evidence ? `“${claim.text}” is an optional claim. Supporting evidence is available for human confirmation.` : `“${claim.text}” is an optional claim, but supporting evidence was not found.`,
      labelValue: claim.text,
    })
    checks.push({ id: `claim-${index}`, label: `Additional claim: ${claim.text}`, status: 'flagged', detail: evidence ? 'Evidence available; human confirmation required' : 'No supporting evidence found' })
  }

  if (label.imageQuality === 'limited') {
    const areas = label.difficultAreas.length ? label.difficultAreas.join(' and ') : 'one or more required areas'
    flags.push({ id: 'image-quality', kind: 'image_quality', title: 'Image evidence needs review', detail: `LabelEvidence could not reliably examine ${areas}. Confirm those areas directly on the artwork.` })
    checks.push({ id: 'image-quality', label: 'Image readability', status: 'flagged', detail: `Unreliable areas: ${areas}` })
  } else checks.push({ id: 'image-quality', label: 'Image readability', status: 'confirmed', detail: 'The submitted artwork was readable' })

  return { caseId: item.id, categoryId: item.category.id, flags, checks, reviewedAt: new Date().toISOString() }
}
