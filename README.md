# LabelEvidence

LabelEvidence is an evidence-led alcohol label review prototype. It compares submitted label information with application facts, linked evidence, and routed disclosure requirements, then sends suspected concerns to a human reviewer.

The prototype does not receive a fixture's intended result or structured label-answer sheet. Runtime evaluation receives an application/evidence packet and an actual raster label image.

## Current demonstration

- 56 independent cases
- 42 cases designed without a planted issue and 14 with varied planted issues; OCR and the routed rules determine the runtime result
- Eight high-level routing profiles
- One-time reviewer introduction and prototype boundary
- A first-in, first-out queue that begins with two individual labels and then a five-label batch
- After the first batch, a deterministic 20% batch chance with batch sizes from three through seven
- Background OCR/image evaluation in queue order
- Category-balanced simulated batches of 40
- Exception-first human review
- Per-concern confirmation or dismissal
- Final approve or return-for-correction decisions
- Previous/Next navigation through individual reviews
- Decisions and reviewer notes preserved across browser refreshes
- Local label-viewing controls for zoom, rotation, brightness, and contrast
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

Each profile contains seven cases. The default workspace pre-evaluates all 56 individual labels. A simulated batch remains available as a secondary demonstration and selects five cases from every profile, producing 40 unique labels.

## Review model

LabelEvidence performs several separate tasks:

1. Routes the product using application and supporting-evidence facts.
2. Turns every applicable rule into a required evidence question.
3. Gives those questions to local OCR and image analysis so reading is requirement-directed.
4. Compares the resulting image evidence with each requirement and application value.
5. Creates one separate concern for every unresolved or conflicting requirement.
6. Inventories and evaluates optional claims separately.
7. Separates image uncertainty from readable conflicts and shows only suspected concerns to the reviewer.

No-red-flag labels remain subject to reviewer approval. Concern resolutions, final decisions, timestamps, and reviewer notes are stored locally in the browser for the prototype and can be deliberately cleared with **Reset all data**. LabelEvidence is decision support, not an autonomous regulatory approval system.

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

The current suite verifies the 56-case distribution, absence of runtime expected-result fields, balanced 40-label selection, FIFO batch rules, separate human concerns, reviewer-attested batch approval, saved final decisions, and the underlying rule-engine behavior retained in the repository. Real OCR behavior is also checked in the running browser because it intentionally is not replaced by a structured fixture evaluator.

## Prototype boundary

The current case library demonstrates the architecture and reviewer workflow through a controlled subset of product facts and review conditions. It is not represented as a complete implementation of every TTB, FDA, CBP, USDA, or other regulatory requirement. Expanding regulatory coverage requires sourced rules, effective-date management, expert validation, and additional evidence types.

The previous reviewer prototype is preserved by Git checkpoint `checkpoint/pre-label-evidence-2026-08-22`. The active redesign lives on `feature/label-evidence-reboot`.
