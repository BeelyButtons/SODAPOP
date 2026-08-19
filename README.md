# SODAPOP

SODAPOP — System for Optical Detection, Analysis & Packaging-Oversight Processing — is an AI-assisted proof of concept for reviewing distilled-spirits label artwork against selected TTB COLA application values and federal warning requirements.

> **Prototype boundary:** SODAPOP is decision support, not an autonomous approval system. It surfaces evidence, discrepancies, and uncertainty, then requires a qualified staff member to make and submit the final Pass or Fail decision.

## Current status

- Single-label review: working
- Resumable demonstration review queue: working
- Quick-fail confirmation and automatic move to the next label: working
- Remaining-only queue with locked completed-decision history: working
- Review-again workflow that returns to completed decisions: working
- Sticky reviewer controls with OCR confidence and elapsed time: working
- Saved 90-degree label rotation without an OCR rerun: working
- Staff Pass/Fail determination for every reviewed item: working
- Final decision rule and submission control: working
- Synthetic compliant, failure, varied-layout, and difficult-photo cases: included
- Local OCR benchmark: 0.6–1.1 seconds on the included 1400×1900 samples after local testing
- Coordinate-backed label highlighting: working
- Angled-label deskewing and orientation-aware highlights: working
- Conditional glare and alternate-orientation OCR retries: working
- URL-aware SPA views for the queue, individual cases, new-label intake, and results: working
- Automated verification: 37 tests, GitHub Pages production build, and lint checks passing
- Batch review: planned after the single-label workflow is validated
- Live URL: [https://beelybuttons.github.io/SODAPOP/](https://beelybuttons.github.io/SODAPOP/)

## What it does

1. Presents unfinished demonstration labels in a staff review queue with a remaining count.
2. Starts with the first unfinished label, supports pausing, and resumes from browser-local progress.
3. Also accepts selected application values and a JPEG, PNG, or WebP label image for an independent review.
4. Preprocesses the image and runs Tesseract LSTM OCR entirely in the browser.
5. Compares brand name, class/type, alcohol content, and net contents.
6. Checks the government warning’s exact wording and required uppercase heading.
7. Reports automated `Pass`, `Mismatch`, or `Human review` findings with expected and observed evidence.
8. Highlights detected label text in green for a match, red for a confirmed issue, or amber for human review.
9. Sorts mismatches and human-review findings before confident passes so staff can fail fast.
10. Keeps decision progress, OCR confidence, elapsed time, and Pause visible in a sticky review bar.
11. Requires staff to mark every investigated item `Pass` or `Fail` after examining the evidence.
12. Allows a reviewer to confirm a failure immediately after the first failed item instead of answering irrelevant remaining questions.
13. Confirms a passing decision after every item is marked `Pass`, without a separate final-decision section.
14. Moves to the next queued label after the final decision and returns to an empty queue when work is complete.
15. Stores completed decisions in a separate locked history with an explicit Review Label Again action.
16. Rotates any label preview in 90-degree steps while keeping OCR highlights aligned, without rerunning OCR for a display-only change.
17. Measures processing time against the five-second usability target.

The application uses meaningful browser routes even though it remains a client-side SPA:

- `/SODAPOP/review` — review portal and demonstration queue
- `/SODAPOP/review/:case-id` — an individual queued-label review
- `/SODAPOP/review/completed` — completed label decisions
- `/SODAPOP/review/completed/:case-id` — locked completed review
- `/SODAPOP/review/completed/:case-id/review-again` — editable repeat review that returns to history
- `/SODAPOP/review/new` — application values and independent label intake
- `/SODAPOP/results` — automated evidence, staff determinations, and final decision

GitHub Pages receives a `404.html` copy of the SPA entry point so direct links and browser refreshes can return to the appropriate client-side route. Results are intentionally session-only; directly opening `/results` without an active review returns the user to `/review`.

The included synthetic cases demonstrate a matching label, incorrect ABV, incorrect warning capitalization, improperly bold warning body text, a missing warning, varied label layouts, reverse light-on-dark type, an angled tabletop photograph, and glare/low contrast.

## Product direction and iterative improvement

The workflow is being improved through repeated hands-on review by the project owner in collaboration with Codex. The project owner has driven the practical improvements: simplifying the opening experience, moving privacy information out of the way, making the label easier to inspect, identifying misleading sample-label behavior, requesting status-aware highlights, broadening the test-label designs, and requiring an explicit staff decision instead of treating automation as approval.

That iterative review materially changed the product from a basic OCR comparison demo into a staff-centered decision-support workflow. The project owner's latest review introduced the portal, persistent queue, sequential review experience, accessible evidence hierarchy, and quick-fail path. Each improvement is evaluated against a simple principle: automation should help staff locate and understand evidence, while staff retain responsibility for the regulatory determination.

### Review queue and accessibility improvements

- Every unfinished synthetic case is visible in `Labels to Review` with its purpose.
- Completed cases leave `Labels to Review`; the portal shows only unfinished work and a single Remaining count.
- `Start / Restart label reviews` opens the first unfinished case; `Pause review` returns to the queue without discarding completed decisions.
- Each case has a meaningful browser URL, and the original independent upload form remains available under `New label`.
- Queue progress is stored only in the current browser and can be reset from the portal.
- Application requirements are larger and visually stronger than OCR observations, reflecting what staff must compare the artwork against.
- Controls and evidence text are larger and higher contrast for reviewers who need more readable interfaces.
- Pass and Fail controls use light semantic colors before selection and stronger colors after selection.
- A Fail selection requires explicit confirmation, then records the label failure without forcing the reviewer through the remaining cards.
- Mismatches appear first in prominent red cards, human-review findings follow in amber, and confident passes come last.
- A sticky command bar keeps staff progress, OCR confidence, elapsed time, and Pause visible while the cards scroll.
- Compact cards combine the checked item with its application requirement and remove duplicate observed-text and location-link clutter.
- Completed decisions are locked against accidental edits. Review Label Again starts a fresh determination and returns to the reviewer’s position in completed history.
- Label artwork can be rotated clockwise or counterclockwise and saved at 90-degree intervals. The image and highlight layer rotate together, avoiding an unnecessary OCR rerun and protecting the five-second budget.

### Recent OCR reliability improvements

Hands-on review of the angled Ember & Ash and glare-affected Harbor Light examples exposed failures that clean synthetic artwork did not. The resulting improvements are deliberate rather than cosmetic:

- Small label images are upscaled before recognition so regulatory text receives enough pixels.
- Tesseract automatic rotation is enabled for ordinary skewed photographs.
- When expected evidence remains weak, SODAPOP conditionally retries with local adaptive thresholding designed for uneven lighting and glare.
- Difficult orientations are retried at 180°, 90°, and -90° only when earlier passes do not meet the quality gate.
- The best OCR attempt is selected using expected application fields and warning evidence, not overall OCR confidence alone.
- Field matching retains OCR line geometry so nearby values such as `750 mL` are less likely to be absorbed into class/type.
- Meaningful brand punctuation, including `&`, is preserved instead of being silently normalized away.
- OCR boxes are transformed back onto the original photograph and rendered as polygons, allowing highlights to follow angled words.
- A warning that OCR cannot confidently locate is sent to staff review rather than automatically treated as a confirmed mismatch. A detected substitute statement or conflicting wording can still produce a mismatch.

These changes use the existing performance budget intelligently: clean images keep the fast path, while difficult images receive extra processing instead of an artificial delay.

## Why this architecture

```text
Label image → upscale/contrast → orientation-aware OCR → quality gate
                              ↘ conditional enhanced/rotated retries ↗
                                                     ↓
                                           structured extraction
                                                     ↓
Application values → validation → deterministic comparison rules → review evidence
```

- **React + TypeScript + Vite:** small, fast, typed browser application.
- **Zod:** one validation contract for application and file metadata.
- **Tesseract.js:** zero-cost local OCR with no external ML endpoint at review time.
- **Deterministic verification:** exact and numeric regulatory checks do not depend on generative-model judgment.
- **Quality-gated retries:** extra OCR work is performed only when expected label evidence remains incomplete.
- **No database or accounts:** only demonstration-queue decisions are persisted in browser storage; images and extracted label content remain in memory.
- **Static deployment:** the current slice can run on GitHub Pages without a paid backend.

The OCR worker, WebAssembly runtime, and English language model are served from the application’s own origin. A restricted client network does not need access to third-party OCR or CDN domains.

## Application data represented

The real process uses COLAs Online or [TTB Form 5100.31](https://www.ttb.gov/media/70320/download?inline=). This standalone prototype does not reproduce or integrate with COLAs Online. Its review packet contains only the fields needed for the demonstrated comparisons:

- Brand name
- Class/type
- Alcohol content
- Net contents
- Container volume, used to select warning-size requirements
- Label artwork

Class/type is included because it is part of the exercise’s expected review, even though it is not necessarily entered as an independent field on every current COLA application. A future integration should map from the authoritative COLAs Online data contract rather than this prototype form.

## Government warning rule

The exact statement is stored as a versioned constant from [27 CFR § 16.21](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16/subpart-C/section-16.21). Formatting requirements come from [27 CFR § 16.22](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16/subpart-C/section-16.22) and [TTB guidance](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning).

The automated rule checks:

- Exact wording after collapsing line-wrapping whitespace
- Required uppercase `GOVERNMENT WARNING` heading
- Container-based type-size and characters-per-inch requirement presented to the reviewer

The app compares detected ink density within the warning to flag a clear case where body text appears materially bolder than surrounding body lines. It still returns `Human review` for uncertain weight, physical type size, contrast, and separation when they cannot be proven from a raster image. A photograph has no reliable physical scale, and OCR-based weight detection remains an aid rather than conclusive physical measurement.

## Security, privacy, and retention

This prototype minimizes its data boundary instead of claiming production federal compliance:

- Images are processed locally in browser memory.
- No image, OCR text, application value, or user identity is uploaded or retained.
- No database, cookies, analytics, or user accounts are used.
- Demonstration decisions, per-check staff determinations, automated findings, timing, and saved orientation are stored in local browser storage so staff can pause, inspect locked history, and review a label again. They can be cleared with `Reset review queue` and are never transmitted.
- Independent uploaded-label decisions remain session-only.
- Files are limited to 10 MB and validated by size, declared MIME type, and binary signature.
- Only JPEG, PNG, and WebP inputs are accepted; SVG and executable formats are rejected.
- Repository and deployment workflows contain no credentials.
- The UI avoids logging extracted label content.

A production implementation would still require an agency-approved threat model, authentication and authorization, audit logging designed to avoid sensitive content, retention controls, malware scanning, accessibility review, dependency monitoring, incident procedures, and formal authorization appropriate to its hosting environment.

## Validation and errors

Validation occurs before OCR and again when review starts. The interface provides field-level errors for invalid application data and clear errors for unsupported, oversized, or disguised files. OCR initialization and recognition have bounded timeouts; a failed worker is discarded so a retry starts cleanly. Low-confidence or missing evidence is referred to a human instead of being silently accepted.

Batch processing will isolate failures so one invalid label cannot fail an entire batch.

## Local setup

Prerequisites: Node.js 22 or later and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. No environment variables, database, or API key are required.

## Verification commands

```bash
npm run lint
npm test
npm run build
```

GitHub Actions runs all three checks for pushes and pull requests. A separate workflow builds and deploys `main` to GitHub Pages.

Third-party runtime notices are retained under `licenses/`.

## Repository structure

```text
src/
  components/       Accessible intake, evidence, staff-decision, and result views
  data/             Synthetic label fixtures
  domain/           Schemas, normalization, and verification rules
  ocr/              Local OCR initialization and preprocessing
  routing.ts        Browser-history routes that respect the deployed base path
  test/             Shared test setup
public/ocr/          Same-origin OCR worker, runtime, and language assets
.github/workflows/  CI and GitHub Pages deployment
```

## Assumptions and limitations

- The initial scope is distilled spirits; wine and malt-beverage rules are not implemented.
- This prototype uses manual application entry. Batch CSV input comes next.
- OCR accuracy still depends on image quality. Included glare, perspective, upside-down, varied-layout, and reverse-type fixtures expose these limitations for staff evaluation and regression testing.
- The five-second result is a development-machine measurement on synthetic fixtures, not a service-level guarantee.
- Physical font measurements cannot be conclusively derived from ordinary photographs.
- Fuzzy matching assists triage but never overrides an exact regulatory rule.
- No direct COLAs Online integration is attempted.

## Cost

The current implementation has no application runtime fee: all processing is local and the planned public host is GitHub Pages. GitHub account or organizational policies may still affect deployment availability. A future cloud-AI fallback or always-on backend would be separately evaluated and would not be enabled without an explicit budget decision.

## Next increment

1. Validate the new queue, pause/restart behavior, readability, and quick-fail experience with staff reviewers.
2. Continue the single-label rule sequence with deeper brand name, alcohol content, net contents, and additional checks.
3. Expand browser-level OCR regression benchmarks for angled, glare, dark, and upside-down fixtures.
4. Add CSV plus multiple-image batch intake with deterministic image-to-row matching.
5. Process a limited number of labels concurrently and preserve per-item failures and staff decisions.
6. Export a review summary and add wine and malt-beverage rule modules if appropriate.
