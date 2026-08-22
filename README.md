# SODAPOP

SODAPOP — System for Optical Detection, Analysis & Packaging-Oversight Processing — is an AI-assisted proof of concept for reviewing beverage-alcohol label artwork against selected TTB COLA application values and federal warning requirements.

> **Prototype boundary:** SODAPOP is decision support, not an autonomous approval system. It surfaces evidence, discrepancies, and uncertainty, then requires a qualified staff member to make and submit the final Pass or Fail decision.

## Current status

- Single-label review: working
- Resumable, searchable demonstration review table: working
- Quick-fail confirmation and automatic move to the next label: working
- Remaining-only queue with locked completed-decision history: working
- Searchable, filterable, date-sortable completed-decision table: working
- Per-card decision changes with preserved answers and immutable revisions: working
- Sticky reviewer controls with OCR confidence and elapsed time: working
- Saved 90-degree label rotation without an OCR rerun: working
- Staff Pass/Fail determination for every reviewed item: working
- View-gated bulk Pass for remaining green findings only: working; red and amber findings always require individual review
- Reversible results-layout comparison: working on the feature branch; the current card view remains the default while a simplified preview groups every spirits, wine, and malt review into the same seven sections
- Simplified section decisions: working; passed sections can be accepted together, related requirements stay available in collapsed details, and one section decision is recorded across its underlying checks
- Recognition uncertainty separation: working in the simplified preview; failure to locate text is shown as `Not automatically verified`, while positively observed contradictions remain potential problems
- Reviewer case-file preview: implemented alongside the current workflow, with three cross-category synthetic cases that separate application assertions, authorization results, product determinations, supporting evidence, label-package records, claims, and history; live review integration remains intentionally deferred
- Final decision rule and submission control: working
- Synthetic compliant, failure, varied-layout, and difficult-photo cases: included
- Pre-malt expanded-case benchmark: 3.6–4.9 seconds on clear, conditional, blurred, and obstructed samples with a warm OCR engine; the varied malt queue is the current hands-on performance check
- Coordinate-backed label highlighting: working, including combined regions for multiple visually detected facts used by one finding
- Angled-label deskewing and orientation-aware highlights: working
- Rule-aware OCR recovery: working, with a two-pass limit, a 4.8-second recovery budget, selective upside-down recovery, and complementary evidence merging
- URL-aware SPA views for the queue, individual cases, new-label intake, and results: working
- Automated verification: 222 routing, rule-coverage, interface, OCR, decision-workflow, case-file, and regression tests passing, plus GitHub Pages production-build and lint checks
- Post-rule-expansion routing foundation: working, with seven TTB review/routing rule sets, tri-state applicability, automatic selection, transparent selection reasons, and reviewer overrides
- Cached-evidence rule-set reanalysis: working without a second OCR pass; alternative rule sets are ranked only when the reviewer opens the rule control
- Centered rule-set window: working with a pinned close control, outside-click and Escape dismissal, applicable-first rule details, collapsed non-applicable rules, focus restoration, and a compact alternative selector
- Expanded distilled-spirits review: working for domestic/imported base requirements and conditional formula, exemption, bottle, composition, age, production, color, sulfite, and aspartame branches
- Distilled-spirits regression queue: 23 cases spanning clear matches, explicit conflicts, missing context, incorrect routing, formula disclosures, permitted age understatement, prohibited age overstatement, glare, blur, low contrast, perspective, rotation, and partial obstruction
- Expanded wine review: working for domestic and imported wines at 7% alcohol or more, plus the TTB domestic-wine labeling and health-warning branch below 7%
- Wine regression queue: 11 cases spanning supported and conflicting appellation/varietal evidence, estate bottling, imported origin, formula disclosures, below-7% complete and incomplete labels, and glare
- Expanded malt-beverage review: working for domestic/imported base requirements, specialty products, conditional alcohol statements and claims, post-import bottling, geography, formula instructions, and additive disclosures
- Malt-beverage regression queue: 13 cases using six deliberately different design systems plus glare and angled-photo treatments; the total demonstration queue now contains 47 labels
- Batch review: planned after the single-label workflow is validated
- Live URL: [https://beelybuttons.github.io/SODAPOP/](https://beelybuttons.github.io/SODAPOP/)

## What it does

1. Presents unfinished demonstration labels in a searchable, filterable staff table with product, source, automatically selected rule set, status, and a remaining count.
2. Starts with the first unfinished label, supports pausing, and resumes from browser-local progress.
3. Also accepts selected application values and a JPEG, PNG, or WebP label image for an independent review.
4. Preprocesses the image and runs Tesseract LSTM OCR entirely in the browser.
5. Compares brand name, class/type, alcohol content, and net contents.
6. Checks the government warning’s exact wording and required uppercase heading.
7. Reports automated `Pass`, `Mismatch`, or `Human review` findings with expected and observed evidence.
8. Highlights detected label text in green for a match, red for a confirmed issue, or amber for human review; when one analysis relies on separated statements such as `SMALL BATCH` and `AGED 4 YEARS`, all relevant regions are highlighted together.
9. Sorts mismatches and human-review findings before confident passes so staff can fail fast.
10. Keeps decision progress, OCR confidence, elapsed time, and Pause visible in a sticky review bar.
11. Requires staff to mark every investigated item `Pass` or `Fail` after examining the evidence; after every card has actually entered the viewport, staff may mark all remaining green findings Pass in one action while red and amber findings remain mandatory individual decisions.
12. Allows a reviewer to confirm a failure immediately after the first failed item instead of answering irrelevant remaining questions.
13. Confirms a passing decision after every item is marked `Pass`, without a separate final-decision section.
14. Moves to the next queued label after the final decision and returns to an empty queue when work is complete.
15. Stores completed decisions in a searchable table that can be filtered by outcome, product, domestic/imported source, or applied rule set and sorted by decision time.
16. Gives every submitted decision a unique ID and preserves earlier revisions instead of overwriting them.
17. Lets staff change an individual card decision while retaining prior answers and requiring a newly submitted final determination.
18. Rotates any label preview in 90-degree steps while keeping OCR highlights aligned, without rerunning OCR for a display-only change.
19. Zooms label artwork from 50% to 200% in 10% increments around the active evidence, then supports click-and-drag or touch panning while scaling and moving the image and OCR highlight layer together.
20. Measures processing time against the five-second usability target.
21. Selects a TTB rule set from the COLA application context: beverage type, domestic/imported source, and wine alcohol content.
22. Shows the applied rule set and its selection reasons in the sticky review bar; the centered rule window prioritizes applicable and missing-context rules while keeping non-applicable rules available behind an intentional disclosure.
23. Lets staff inspect a full rule reference in a separate browser tab, override a mistaken selection, and rerun deterministic analysis from cached OCR and image evidence.
24. Produces a staff Pass/Fail card for every applicable implemented beverage rule instead of limiting review to the original six comparisons.
25. Recommends Pass or Mismatch when application/supporting information and readable artwork evidence support that result; it uses Human review only when context or visible evidence is genuinely unresolved.
26. Explains why selected distilled-spirits rules apply, exposes the specific application/supporting fact behind a conclusion, and identifies what the label actually showed instead of referring vaguely to a “review packet.”
27. Highlights brand, class/type, and alcohol content together for same-field-of-vision review, names the exact unresolved field, and recognizes and highlights supported age statements in years, months, or days.
28. Applies the TTB age distinction that a label may understate documented age but may not overstate it, rejects maximum-age wording, and prevents an understatement from conflicting with the domestic straight-whisky standard of identity.
29. Exercises every distilled-spirits conditional rule through `applies`, `does not apply`, and `missing context` tests, so missing application facts cannot silently route a conditional check away.
30. Applies domestic and imported wine rules for alcohol statements, responsible-party information, brand-label placement, country of origin, appellation, varietal, vintage, estate bottling, foreign-wine percentage, formula composition, sulfites, Yellow No. 5, and cochineal/carmine disclosures.
31. Routes domestic wine below 7% alcohol out of Part 4 while still checking the Part 24 premises name/address, brand when different, alcohol content, net contents, kind of wine, and the Part 16 health warning when applicable; FDA rules remain outside this TTB prototype.
32. Applies domestic and imported malt-beverage rules for brand, recognized or specialty identity, U.S.-unit net contents, responsible-party information, conditional alcohol content, low/non-alcoholic claims, country of origin, post-import bottling, geographic qualification, formula directions, sulfites, aspartame, Yellow No. 5, and cochineal/carmine.
33. Distinguishes ordinary malt beverages from formula-backed specialties and reserves alcohol-content cards for statements that are mandatory, voluntarily displayed, or otherwise activated by the review evidence.
34. Offers a reversible simplified-results preview with the same seven ordered sections for distilled spirits, wine, and malt beverages; category-specific and conditional requirements remain available beneath those stable headings.
35. Keeps application-declared requirements in scope even when OCR misses their text, allows detected label claims to add scrutiny, and does not present a text-recognition miss as a confirmed contradiction in the simplified preview.

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

The included synthetic cases demonstrate a matching label, incorrect ABV, incorrect warning capitalization, improperly bold warning body text, a missing warning, varied layouts, reverse type, perspective, rotation, glare, blur, partial obstruction, domestic and imported routing, a country-of-origin conflict, allowed age understatement, prohibited age overstatement, deliberately incorrect routing, missing packet context, complete, missing, and conflicting formula disclosures, significant solids, neutral spirits, wood treatment, State of distillation, carmine, intrastate exemption wording, and distinctive-bottle evidence.

## Product direction and iterative improvement

The workflow is being improved through repeated hands-on review by the project owner in collaboration with Codex. The project owner has driven the practical improvements: simplifying the opening experience, moving privacy information out of the way, making the label easier to inspect, identifying misleading sample-label behavior, requesting status-aware highlights, broadening the test-label designs, requiring an explicit staff decision instead of treating automation as approval, replacing destructive re-review with a reviewer-friendly correction and audit-history workflow, turning both work queues into searchable tables designed for fast scanning and copy/paste work, requiring conclusions to expose their actual evidence, and reducing repetitive clicks without allowing red or amber findings to bypass individual staff review.

That iterative review materially changed the product from a basic OCR comparison demo into a staff-centered decision-support workflow. The project owner's latest review introduced the portal, persistent queue, sequential review experience, accessible evidence hierarchy, and quick-fail path. Each improvement is evaluated against a simple principle: automation should help staff locate and understand evidence, while staff retain responsibility for the regulatory determination.

### Post-rule expansion

The project owner defined all work through the current distilled-spirits experience as the **pre-rule-expansion** phase. The next phase expands SODAPOP into TTB rule selection and review support for domestic and imported distilled spirits, wine, and malt beverages while preserving the established staff Pass/Fail workflow.

Before changing the interface or verification behavior, the approved research catalog was converted into a formal specification in [`docs/post-rule-expansion-specification.md`](docs/post-rule-expansion-specification.md) and `src/domain/ruleSpecification.ts`. It defines one record per reviewer-facing rule, the application/formula/supporting facts needed to decide applicability, seven initial regulatory rule sets, explicit missing-context behavior, and integrity tests. Wine below 7 percent alcohol by volume is represented as a TTB jurisdiction-routing branch without implementing FDA rules.

The project owner's reviewer safeguard is now implemented: the selected rule set is visible in the sticky decision bar, explains why it was selected, provides a separate full-reference view, and permits a deliberate reviewer override followed by reanalysis. The project owner specifically required protection against an incorrectly inferred branch without slowing routine work. SODAPOP therefore ranks alternatives only when the reviewer opens the control, clearly warns about conflicts with the application facts, clears stale card decisions when the rule set changes, and reuses cached OCR text, word coordinates, and image evidence. A later owner review exposed that the original window could be constrained by the sticky command bar and difficult to dismiss. The rule window now opens in a true page-level overlay, stays centered, pins its heading and close control while content scrolls, closes by X, Escape, or outside click, restores focus, shows applicable rules first, and keeps non-applicable rules collapsed. This preserves transparency without adding another expensive OCR pass or burdening the initial five-second analysis target.

The project owner next required actual domestic and imported distilled-spirits cards and a regression queue that resembles real review conditions instead of repeating clean, nearly identical artwork. Combining regulatory branches with image defects exposed an unnecessary retry loop: an obstructed label had already yielded four of five core evidence groups, but OCR kept rescanning for the covered field and took 12.9 seconds. The quality gate now stops that high-confidence partial pass, surfaces the covered field for staff review, and completed the same case in 3.8 seconds during local validation.

The first distilled-spirits hardening pass then tested every conditional branch in all three applicability states and added reviewer-visible edge cases for age and formula conflicts. This work corrected an over-strict age comparison: under [27 CFR 5.74](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5/subpart-E/section-5.74), age may be understated but not overstated, and maximum-age forms are not acceptable. SODAPOP now distinguishes those outcomes, supports years, months, and days, preserves the standard-of-identity safeguard for domestic straight whisky, and declines to guess whether a packet means cochineal extract or carmine when the specific additive is missing. Live local OCR validation returned the new age-understatement, age-overstatement, and formula-conflict cases in 1.7–1.8 seconds with the intended Pass/Mismatch recommendations.

The project owner then directed the wine expansion to remain firmly within TTB's review role: domestic and imported branches, explicit jurisdiction routing below 7% alcohol, strong automated recommendations wherever the evidence supports them, and staff Pass/Fail on every applicable card. That direction corrected an important early simplification. Domestic wine below 7% is not merely a warning-routing case; TTB's Part 24 guidance also requires premises name/address, brand when different, alcohol content, net contents, and kind-of-wine evidence. The implemented wine engine now covers those requirements plus the Part 4 alcohol, responsibility, origin, appellation, varietal, vintage, estate, formula, sulfite, and color-additive branches. Eleven visibly varied wine cases bring the demonstration queue to 34 labels. Live browser OCR checks completed clear, imported, formula, below-7%, and glare cases in 1.8–2.3 seconds on the development machine.

For the malt-beverage increment, the project owner explicitly rejected the visual sameness common to synthetic regression labels. That direction changed the fixture strategy as well as the rule engine. The 13 new cases use circular mid-century can graphics, a narrow European heritage bottle, neon fruit-forward specialty artwork, spacious low/non-alcohol typography, blueprint-style geographic labeling, and an industrial post-import can instead of recycling one rectangular template with different colors. The cases cover domestic and imported products, origin conflicts, formula omissions and composition conflicts, low/non-alcoholic thresholds, geographic qualification, U.S. post-import canning, glare, and off-axis photography. This makes OCR and reviewer testing more representative of the variety encountered in real label artwork.

Testing those more varied malt labels exposed a service problem that uniform artwork had hidden: the OCR quality gate always searched for the same five fields, even when a malt alcohol statement or government warning was not applicable. Busy designs could therefore trigger repeated full-image scans, take roughly 12.5 seconds, and still discard text that appeared only in a secondary pass. At the project owner's direction, the correction improves the service rather than making the test artwork easier. OCR evidence is now selected from the actual beverage rules and application facts, equivalent volume statements tolerate ordinary conversion rounding, and the fast path is followed by no more than one targeted recovery pass. That recovery uses a complementary page-layout mode for dense text, tries an upside-down orientation only when the first result is nearly empty, and returns within a 4.8-second recovery budget instead of starting 90-degree scans. Text and coordinates from successful passes are merged so one pass can contribute the brand while another contributes a disclosure. Pass timings and the retry reason are retained with the review outcome for performance diagnosis without adding reviewer clicks.

### Review queue and accessibility improvements

- Every unfinished synthetic case is visible in a semantic table with its purpose, product, source, automatically selected rule set, status, and direct Review action.
- The remaining table can be searched and filtered by product, domestic/imported source, or rule set without running OCR.
- Completed cases leave `Labels to Review`; the portal shows only unfinished work and a single Remaining count.
- The confirmed queue-reset control sits beside the Remaining count it affects.
- `Start / Restart label reviews` opens the first unfinished case; `Pause review` returns to the queue without discarding completed decisions.
- Each case has a meaningful browser URL, and the original independent upload form remains available under `New label`.
- Queue progress is stored only in the current browser and can be reset from the portal.
- Application requirements are larger and visually stronger than OCR observations, reflecting what staff must compare the artwork against.
- Controls and evidence text are larger and higher contrast for reviewers who need more readable interfaces.
- Pass and Fail controls use light semantic colors before selection and stronger colors after selection.
- Fail is consistently positioned on the left and Pass on the right. A bulk-Pass control appears at the bottom only after every card has entered the viewport, and it changes only undecided green findings.
- If bulk Pass leaves red or amber findings undecided, an explicit reminder names every remaining item and returns the reviewer to the first one; those findings can never be changed by the bulk action.
- A Fail selection requires explicit confirmation, then records the label failure without forcing the reviewer through the remaining cards.
- Mismatches appear first in prominent red cards, human-review findings follow in amber, and confident passes come last.
- A sticky command bar keeps staff progress, OCR confidence, elapsed time, and Pause visible while the cards scroll; the sticky artwork panel dynamically offsets below it so neither the image nor its active status badge is obscured.
- The sticky compliance command bar appears before the queued-label title and description, putting the reviewer’s task and progress first without changing its scrolling behavior.
- Compact cards bold only the checked-item name. Government-warning formatting uses a labeled, responsive requirements list instead of a dense semicolon-separated sentence.
- Completed decisions use the same copy-friendly table pattern and are searchable by keyword or decision ID, filterable by outcome, product, source, or applied rule set, sortable by date, and stamped with the local decision date and time.
- `Completed reviews` is permanently available in primary navigation and remains visibly active on completed-list, decision-detail, and amendment routes.
- Completed cards are locked against accidental edits. `Change decision` appears only when staff actually recorded Pass or Fail; cards skipped after Quick Fail have no decision to change. A confirmed change preserves earlier answers and makes unanswered cards available only when they are needed to reach a new final determination.
- Every correction creates a uniquely addressed revision. Earlier decisions remain available in the on-screen history instead of being overwritten.
- Label artwork uses one compact control row for orientation and zoom. It can be rotated clockwise or counterclockwise and saved at 90-degree intervals, or zoomed from 50% to 200% in 10% steps around active evidence. Above 100%, staff can click and drag (or drag by touch) to inspect any part of the artwork without persistent helper text consuming preview space. The image and highlight layer transform and move together, avoiding an unnecessary OCR rerun, keeping hover evidence aligned and visible, and protecting the five-second budget.

### Recent OCR reliability improvements

Hands-on review of the angled Ember & Ash and glare-affected Harbor Light examples exposed failures that clean synthetic artwork did not. The resulting improvements are deliberate rather than cosmetic:

- Small label images are upscaled before recognition so regulatory text receives enough pixels.
- Tesseract automatic rotation is enabled for ordinary skewed photographs.
- Expected evidence is derived from the selected beverage context. Optional malt alcohol statements and government warnings below 0.5 percent alcohol no longer create false missing-evidence penalties, while imported origin and conditional formula evidence are included when applicable.
- When required evidence remains weak, SODAPOP permits one recovery pass with local adaptive thresholding and a complementary dense-layout reading mode designed for uneven lighting, busy artwork, and small disclosures.
- An upside-down retry is reserved for nearly empty, low-confidence first passes. Costly 90-degree retry loops are no longer part of the automatic path.
- Recovery work is limited to two total whole-image passes and a 4.8-second result budget. If the recovery pass reaches that budget, the first-pass evidence is returned instead of making the reviewer wait for more scans.
- Successful passes are merged rather than forcing one winner to contain every fact. Complementary text and non-duplicate word coordinates remain available for matching and highlights.
- The primary pass is still selected using applicable application fields and warning evidence, not overall OCR confidence alone.
- Per-pass timing and retry-reason diagnostics travel with the review outcome so slow cases can be investigated without exposing more controls to reviewers.
- Field matching retains OCR line geometry so nearby values such as `750 mL` are less likely to be absorbed into class/type.
- Meaningful brand punctuation, including `&`, is preserved instead of being silently normalized away.
- OCR boxes are transformed back onto the original photograph and rendered as polygons, allowing highlights to follow angled words.
- A warning that OCR cannot confidently locate is sent to staff review rather than automatically treated as a confirmed mismatch. A detected substitute statement or conflicting wording can still produce a mismatch.

These changes use the existing performance budget intelligently: clean images keep the fast path, while difficult images receive one bounded opportunity to recover useful evidence. Browser timing still depends on the review device, image size, and whether the local OCR engine is already warm, so the varied malt queue remains the practical end-to-end performance test.

## Why this architecture

```text
Label image → upscale/contrast → rule-aware OCR → evidence quality gate
                              ↘ one bounded recovery pass ↗
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
- **Rule-driven beverage evaluation:** applicable distilled-spirits, wine, and malt-beverage rules become evidence cards using COLA, formula, permit, production, and OCR facts.
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
- COLA/exemption application type and destination State
- Applicant and permit name/address context
- Formula identity, class/type, composition, and labeling instructions
- Complete-label, container-marking, label-dimension, and distinctive-bottle evidence
- Imported country-of-origin and bottling-disposition facts
- Conditional composition and production facts for solids, neutral spirits, age, wood treatment, State of distillation, color additives, sulfites, and aspartame
- Wine origin, appellation type and percentage, varietal composition, vintage support, estate-production continuity, foreign-law support, and foreign-wine blend percentage
- Malt specialty, alcohol-contribution, displayed-alcohol, alcohol-characterization, geographic-designation, and post-import bottling facts

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

- Automatic rule-set routing and reviewer cards now cover distilled spirits, wine, and malt beverages across the implemented domestic/imported base and conditional branches.
- This prototype uses manual application entry. Batch CSV input comes next.
- OCR accuracy still depends on image quality. Included glare, perspective, upside-down, varied-layout, and reverse-type fixtures expose these limitations for staff evaluation and regression testing.
- The five-second result is a development-machine measurement on synthetic fixtures, not a service-level guarantee.
- Physical font measurements cannot be conclusively derived from ordinary photographs.
- Fuzzy matching assists triage but never overrides an exact regulatory rule.
- No direct COLAs Online integration is attempted.

## Cost

The current implementation has no application runtime fee: all processing is local and the planned public host is GitHub Pages. GitHub account or organizational policies may still affect deployment availability. A future cloud-AI fallback or always-on backend would be separately evaluated and would not be enabled without an explicit budget decision.

## Next increment

1. Project-owner review of the expanded malt-beverage cards and 13-case visually varied malt regression set.
2. Refine any recommendation or sample that hands-on review exposes as misleading, overly confident, or unnecessarily manual.
3. Test difficult and incomplete application packets and label photos systematically across all three beverage categories.
4. Return to batch intake and export only after the single-label rule-expanded workflow is accepted.
