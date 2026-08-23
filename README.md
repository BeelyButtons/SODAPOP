# LabelEvidence

LabelEvidence is an evidence-led alcohol label review prototype. It compares submitted label information with application facts, linked evidence, and routed disclosure requirements, then sends suspected concerns to a human reviewer.

The prototype does not receive a fixture's intended result. Runtime evaluation receives only the application record, evidence records, label information, and image-quality facts.

## Current demonstration

- 56 independent cases
- 42 cases that evaluate with no red flags
- 14 cases that evaluate with one or more concerns
- Eight high-level routing profiles
- Category-balanced simulated batches of 40
- Exception-first human review
- Per-concern confirmation or dismissal
- Expandable complete review
- Reviewer-attested bulk approval for labels with no detected red flags

### Routing profiles

1. Domestic wine at or above 7% ABV
2. Imported wine at or above 7% ABV
3. Domestic wine under 7% ABV
4. Imported wine under 7% ABV
5. Domestic distilled spirits
6. Imported distilled spirits
7. Domestic malt beverages
8. Imported malt beverages

Each profile contains seven cases. A simulated batch selects five cases from every profile, producing 40 unique labels. Selection is random but reproducible from the saved batch seed.

## Review model

LabelEvidence performs several separate tasks:

1. Routes the product using application facts.
2. Checks whether required evidence is available.
3. Compares application fields with label information.
4. Checks conditional disclosures and warning presentation.
5. Identifies optional claims requiring human judgment.
6. Separates image uncertainty from compliance findings.
7. Shows suspected concerns before successful checks.

No-red-flag labels remain subject to reviewer approval. LabelEvidence is decision support, not an autonomous regulatory approval system.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

## Verification

```bash
npm test
npm run lint
npm run build
```

The current suite verifies the 56-case distribution, absence of runtime expected-result fields, exact 75/25 clear-to-flagged evaluation mix, balanced batch selection, repeatable seeds, review controls, and the pre-existing rule-engine behavior retained in the repository.

## Prototype boundary

The current case library demonstrates the architecture and reviewer workflow through a controlled subset of product facts and review conditions. It is not represented as a complete implementation of every TTB, FDA, CBP, USDA, or other regulatory requirement. Expanding regulatory coverage requires sourced rules, effective-date management, expert validation, and additional evidence types.

The previous reviewer prototype is preserved by Git checkpoint `checkpoint/pre-label-evidence-2026-08-22`. The active redesign lives on `feature/label-evidence-reboot`.
