# SODAPOP

SODAPOP — System for Optical Detection, Analysis & Packaging-Oversight Processing — is an AI-assisted proof of concept for reviewing distilled-spirits label artwork against selected TTB COLA application values and federal warning requirements.

> **Prototype boundary:** SODAPOP is decision support, not an autonomous approval system. It surfaces evidence, discrepancies, and uncertainty, then requires a qualified staff member to make and submit the final Pass or Fail decision.

## Current status

- Single-label review: working
- Resumable demonstration review queue: working
- Quick-fail confirmation and automatic move to the next label: working
- Remaining-only queue with locked completed-decision history: working
- Searchable, filterable, date-sortable completed-decision history: working
- Per-card decision changes with preserved answers and immutable revisions: working
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
- Automated verification: routing, interface, OCR, decision-workflow, GitHub Pages production-build, and lint checks passing
- Post-rule-expansion routing foundation: working, with seven TTB review/routing rule sets, tri-state applicability, automatic selection, transparent selection reasons, and reviewer overrides
- Cached-evidence rule-set reanalysis: working without a second OCR pass; alternative rule sets are ranked only when the reviewer opens the rule control
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
15. Stores completed decisions in a searchable history that can be filtered by Pass or Fail and sorted by decision time.
16. Gives every submitted decision a unique ID and preserves earlier revisions instead of overwriting them.
17. Lets staff change an individual card decision while retaining prior answers and requiring a newly submitted final determination.
18. Rotates any label preview in 90-degree steps while keeping OCR highlights aligned, without rerunning OCR for a display-only change.
19. Zooms label artwork from 50% to 200% in 10% increments around the active evidence, then supports click-and-drag or touch panning while scaling and moving the image and OCR highlight layer together.
20. Measures processing time against the five-second usability target.
21. Selects a TTB rule set from the COLA application context: beverage type, domestic/imported source, and wine alcohol content.
22. Shows the applied rule set and its selection reasons in the sticky review bar, with per-rule `Applies`, `Does not apply`, or `Missing context` status.
23. Lets staff inspect a full rule reference in a separate browser tab, override a mistaken selection, and rerun deterministic analysis from cached OCR and image evidence.

The application uses meaningful browser routes even though it remains a client-side SPA:

- `/SODAPOP/review` — review portal and demonstration queue
- `/SODAPOP/review/:case-id` — an individual queued-label review
- `/SODAPOP/review/completed` — completed label decisions
- `/SODAPOP/review/completed/:decision-id` — an immutable completed-decision revision
- `/SODAPOP/review/completed/:decision-id/change/:check-id` — a confirmed per-card decision amendment
- `/SODAPOP/review/new` — application values and independent label intake
- `/SODAPOP/results` — automated evidence, staff determinations, and final decision
- `/SODAPOP/rules/:rule-set-id` — a persistent, read-only reference for an individual rule set

GitHub Pages receives a `404.html` copy of the SPA entry point so direct links and browser refreshes can return to the appropriate client-side route. Results are intentionally session-only; directly opening `/results` without an active review returns the user to `/review`.

The included synthetic cases demonstrate a matching label, incorrect ABV, incorrect warning capitalization, improperly bold warning body text, a missing warning, varied label layouts, reverse light-on-dark type, an angled tabletop photograph, and glare/low contrast.

## Product direction and iterative improvement

The workflow is being improved through repeated hands-on review by the project owner in collaboration with Codex. The project owner has driven the practical improvements: simplifying the opening experience, moving privacy information out of the way, making the label easier to inspect, identifying misleading sample-label behavior, requesting status-aware highlights, broadening the test-label designs, requiring an explicit staff decision instead of treating automation as approval, and replacing destructive re-review with a reviewer-friendly correction and audit-history workflow.

That iterative review materially changed the product from a basic OCR comparison demo into a staff-centered decision-support workflow. The project owner's latest review introduced the portal, persistent queue, sequential review experience, accessible evidence hierarchy, and quick-fail path. Each improvement is evaluated against a simple principle: automation should help staff locate and understand evidence, while staff retain responsibility for the regulatory determination.

### Post-rule expansion

The project owner defined all work through the current distilled-spirits experience as the **pre-rule-expansion** phase. The next phase expands SODAPOP into TTB rule selection and review support for domestic and imported distilled spirits, wine, and malt beverages while preserving the established staff Pass/Fail workflow.

Before changing the interface or verification behavior, the approved research catalog was converted into a formal specification in [`docs/post-rule-expansion-specification.md`](docs/post-rule-expansion-specification.md) and `src/domain/ruleSpecification.ts`. It defines one record per reviewer-facing rule, the application/formula/supporting facts needed to decide applicability, seven initial regulatory rule sets, explicit missing-context behavior, and integrity tests. Wine below 7 percent alcohol by volume is represented as a TTB jurisdiction-routing branch without implementing FDA rules.

The project owner's reviewer safeguard is now implemented: the selected rule set is visible in the sticky decision bar, explains why it was selected, provides a separate full-reference view, and permits a deliberate reviewer override followed by reanalysis. The project owner specifically required protection against an incorrectly inferred branch without slowing routine work. SODAPOP therefore ranks alternatives only when the reviewer opens the control, clearly warns about conflicts with the application facts, clears stale card decisions when the rule set changes, and reuses cached OCR text, word coordinates, and image evidence. This keeps transparency and correction available without adding another expensive OCR pass or burdening the initial five-second analysis target.

### Review queue and accessibility improvements

- Every unfinished synthetic case is visible in `Labels to Review` with its purpose.
- Completed cases leave `Labels to Review`; the portal shows only unfinished work and a single Remaining count.
- Remaining work is renumbered from 1 each time, and the confirmed queue-reset control sits beside the Remaining count it affects.
- `Start / Restart label reviews` opens the first unfinished case; `Pause review` returns to the queue without discarding completed decisions.
- Each case has a meaningful browser URL, and the original independent upload form remains available under `New label`.
- Queue progress is stored only in the current browser and can be reset from the portal.
- Application requirements are larger and visually stronger than OCR observations, reflecting what staff must compare the artwork against.
- Controls and evidence text are larger and higher contrast for reviewers who need more readable interfaces.
- Pass and Fail controls use light semantic colors before selection and stronger colors after selection.
- A Fail selection requires explicit confirmation, then records the label failure without forcing the reviewer through the remaining cards.
- Mismatches appear first in prominent red cards, human-review findings follow in amber, and confident passes come last.
- A sticky command bar keeps staff progress, OCR confidence, elapsed time, and Pause visible while the cards scroll.
- The sticky compliance command bar appears before the queued-label title and description, putting the reviewer’s task and progress first without changing its scrolling behavior.
- Compact cards bold only the checked-item name. Government-warning formatting uses a labeled, responsive requirements list instead of a dense semicolon-separated sentence.
- Completed decisions are searchable by keyword or decision ID, filterable by outcome, sortable by date, and stamped with the local decision date and time.
- Completed cards are locked against accidental edits. `Change decision` appears only when staff actually recorded Pass or Fail; cards skipped after Quick Fail have no decision to change. A confirmed change preserves earlier answers and makes unanswered cards available only when they are needed to reach a new final determination.
- Every correction creates a uniquely addressed revision. Earlier decisions remain available in the on-screen history instead of being overwritten.
- Label artwork uses one compact control row for orientation and zoom. It can be rotated clockwise or counterclockwise and saved at 90-degree intervals, or zoomed from 50% to 200% in 10% steps around active evidence. Above 100%, staff can click and drag (or drag by touch) to inspect any part of the artwork without persistent helper text consuming preview space. The image and highlight layer transform and move together, avoiding an unnecessary OCR rerun, keeping hover evidence aligned and visible, and protecting the five-second budget.

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
- Beverage type (distilled spirits, wine, or malt beverage)
- Domestic or imported source

Class/type is included because it is part of the exercise’s expected review, even though it is not necessarily entered as an independent field on every current COLA application. A future integration should map from the authoritative COLAs Online data contract rather than this prototype form.

## Government warning rule

The exact statement is stored as a versioned constant from [27 CFR § 16.21](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16/subpart-C/section-16.21). Formatting requirements come from [27 CFR § 16.22](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16/subpart-C/section-16.22) and [TTB guidance](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning).

The automated rule checks:

- Exact wording after collapsing line-wrapping whitespace
- Required uppercase `GOVERNMENT WARNING` heading
- Container-based type-size and characters-per-inch requirement presented to the reviewer

The app compares detected ink density within the warning to flag a clear case where body text appears materially bolder than surrounding body lines. It still returns `Human review` for uncertain weight, physical type size, contrast, and separation when they cannot be proven from a raster image. The applicable requirements are presented as six reviewer-friendly checks, with container-dependent type size and character-density values calculated for the current label. A photograph has no reliable physical scale, and OCR-based weight detection remains an aid rather than conclusive physical measurement.

## Security, privacy, and retention

This prototype minimizes its data boundary instead of claiming production federal compliance:

- Images are processed locally in browser memory.
- No image, OCR text, application value, or user identity is uploaded or retained.
- No database, cookies, analytics, or user accounts are used.
- Demonstration decisions, immutable revisions, per-check staff determinations, automated findings, timing, and saved orientation are stored in local browser storage so staff can pause, inspect history, and correct a decision without losing prior work. They can be cleared with the confirmed `Reset review queue` action and are never transmitted.
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

- Automatic rule-set routing now covers distilled spirits, wine, and malt beverages. The current reviewer-card implementation remains the pre-expansion distilled-spirits set except for the explicit under-7%-wine TTB warning/routing branch; the full beverage-specific card expansion is the next phase.
- This prototype uses manual application entry. Batch CSV input comes next.
- OCR accuracy still depends on image quality. Included glare, perspective, upside-down, varied-layout, and reverse-type fixtures expose these limitations for staff evaluation and regression testing.
- The five-second result is a development-machine measurement on synthetic fixtures, not a service-level guarantee.
- Physical font measurements cannot be conclusively derived from ordinary photographs.
- Fuzzy matching assists triage but never overrides an exact regulatory rule.
- No direct COLAs Online integration is attempted.

## Cost

The current implementation has no application runtime fee: all processing is local and the planned public host is GitHub Pages. GitHub account or organizational policies may still affect deployment availability. A future cloud-AI fallback or always-on backend would be separately evaluated and would not be enabled without an explicit budget decision.

## Next increment

1. Review the implemented routing, visible rule-set explanation, full-reference route, manual override, and cached-evidence reanalysis in the single-label workflow.
2. Expand the actual domestic and imported distilled-spirits review cards and regression tests from the approved specification.
3. Validate the five-second target on clean and difficult images with the expanded distilled-spirits cards.
4. Add wine and malt-beverage cards in reviewed increments, preserving automatic routing, tri-state applicability, cached evidence, and staff Pass/Fail for every applicable item.
5. Return to batch intake and export only after the single-label rule-expanded workflow is accepted.
