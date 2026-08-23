import { parseAlcohol } from '../domain/normalization'
import { evaluateRuleSet, reviewContextFromApplication, selectAutomaticRuleSet, type RuleSetSelection } from '../domain/ruleEngine'
import { GOVERNMENT_WARNING, type ApplicationData } from '../domain/reviewSchema'

export interface EvidenceQuestion {
  id: string
  label: string
  expected: string[]
  weight: number
  ruleId?: string
  exactText?: boolean
}

function question(id: string, label: string, expected: Array<string | undefined>, weight = 1, ruleId?: string, exactText = false): EvidenceQuestion {
  return { id, label, expected: expected.filter((value): value is string => Boolean(value?.trim())), weight, ruleId, exactText }
}

export function createEvidenceQuestions(application: ApplicationData): { selection: RuleSetSelection; questions: EvidenceQuestion[] } {
  const context = reviewContextFromApplication(application)
  const selection = selectAutomaticRuleSet(context)
  const applicable = new Set(
    selection.selectedRuleSetId
      ? evaluateRuleSet(selection.selectedRuleSetId, context)?.rules.filter((item) => item.status === 'applies').map((item) => item.rule.id) ?? []
      : [],
  )
  const questions: EvidenceQuestion[] = [
    question('brand', 'Brand name', [application.brandName], 1),
    question('classType', 'Class or type', [application.classType], 1),
    question('netContents', 'Net contents', [application.netContents], .9),
  ]
  const abv = parseAlcohol(application.alcoholContent).abv
  if (application.productType === 'distilled_spirits' || application.labelAlcoholStatementPresent || (abv !== null && (abv < 7 || abv > 14))) {
    questions.push(question('alcohol', 'Alcohol content', [application.alcoholContent], .9))
  }
  if (abv !== null && abv >= .5) questions.push(question('warningText', 'Government warning wording', [GOVERNMENT_WARNING], 1.25, 'common.health-warning', true))
  if (application.permitName || application.applicantName) questions.push(question('responsibleParty', 'Responsible party', [application.permitName || application.applicantName, application.permitAddress || application.applicantAddress], .75))
  if (application.source === 'imported') questions.push(question('countryOrigin', 'Country of origin', [application.importCountryOfOrigin], .75))
  if (application.fancifulName) questions.push(question('fancifulName', 'Fanciful name', [application.fancifulName], .55))
  if (application.formulaCompositionStatement) questions.push(question('formulaComposition', 'Formula-directed composition statement', [application.formulaCompositionStatement], .9, 'common.formula-labeling-instructions'))
  for (const [index, instruction] of (application.formulaLabelingInstructions?.split('|') ?? []).filter(Boolean).entries()) {
    if (instruction === application.formulaCompositionStatement) continue
    questions.push(question(`formulaInstruction-${index + 1}`, `Formula labeling instruction ${index + 1}`, [instruction], .45, 'common.formula-labeling-instructions'))
  }
  if ((application.sulfitesPpm ?? 0) >= 10) questions.push(question('sulfites', 'Sulfite declaration', ['CONTAINS SULFITES'], .65))
  if (application.containsYellow5) questions.push(question('yellow5', 'FD&C Yellow No. 5 declaration', ['CONTAINS FD&C YELLOW NO. 5'], .65))
  if (application.containsCochinealOrCarmine) questions.push(question('carmine', 'Carmine or cochineal declaration', ['CONTAINS CARMINE', 'CONTAINS COCHINEAL EXTRACT'], .65))
  if (application.containsAspartame) questions.push(question('aspartame', 'Aspartame declaration', ['PHENYLKETONURICS: CONTAINS PHENYLALANINE'], .65))
  if (application.wineAppellation) questions.push(question('wineAppellation', 'Wine appellation', [application.wineAppellation], .45))
  if (application.wineVintage) questions.push(question('wineVintage', 'Wine vintage', [application.wineVintage], .35))
  if (application.wineEstateBottledClaim) questions.push(question('estateBottled', 'Estate bottled claim', ['ESTATE BOTTLED'], .45))

  return {
    selection,
    questions: questions.filter((item) => !item.ruleId || applicable.has(item.ruleId) || item.id === 'warningText' || item.id.startsWith('formula')),
  }
}
