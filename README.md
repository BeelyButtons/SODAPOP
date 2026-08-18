# LabelCheck

An AI-assisted proof of concept for reviewing distilled-spirits label artwork against selected TTB COLA application values and federal warning requirements.

> **Prototype boundary:** LabelCheck is decision support, not an approval system. It surfaces evidence, discrepancies, and uncertainty for a qualified human reviewer.

## Current status

- Single-label review: working
- Synthetic compliant and failure cases: included
- Local OCR benchmark: 0.6–1.1 seconds on the included 1400×1900 samples after local testing
- Automated checks: 13 passing tests
- Batch review: planned after the single-label workflow is validated
- Live URL: pending GitHub Pages publication

## What it does

1. Accepts selected application values and a JPEG, PNG, or WebP label image.
2. Preprocesses the image and runs Tesseract LSTM OCR entirely in the browser.
3. Compares brand name, class/type, alcohol content, and net contents.
4. Checks the government warning’s exact wording and required uppercase heading.
5. Reports `Pass`, `Mismatch`, or `Human review` for every check with observed evidence.
6. Measures processing time against the five-second usability target.

The included synthetic cases demonstrate a matching label, incorrect ABV, incorrect warning capitalization, and a missing warning.

## Why this architecture

```text
Label image → local preprocessing → local OCR → structured extraction
                                                     ↓
Application values → validation → deterministic comparison rules → review evidence
```

- **React + TypeScript + Vite:** small, fast, typed browser application.
- **Zod:** one validation contract for application and file metadata.
- **Tesseract.js:** zero-cost local OCR with no external ML endpoint at review time.
- **Deterministic verification:** exact and numeric regulatory checks do not depend on generative-model judgment.
- **No database or accounts:** the prototype has no persistence requirement and does not need to collect identity data.
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

The app deliberately returns `Human review` for bolding, physical type size, contrast, and separation when they cannot be proven from a raster image. A photograph has no reliable physical scale, and OCR does not establish font weight.

## Security, privacy, and retention

This prototype minimizes its data boundary instead of claiming production federal compliance:

- Images are processed locally in browser memory.
- No image, OCR text, application value, or user identity is uploaded or retained.
- No database, cookies, analytics, or user accounts are used.
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
  components/       Accessible form, upload, and result views
  data/             Synthetic label fixtures
  domain/           Schemas, normalization, and verification rules
  ocr/              Local OCR initialization and preprocessing
  test/             Shared test setup
public/ocr/          Same-origin OCR worker, runtime, and language assets
.github/workflows/  CI and GitHub Pages deployment
```

## Assumptions and limitations

- The initial scope is distilled spirits; wine and malt-beverage rules are not implemented.
- This prototype uses manual application entry. Batch CSV input comes next.
- OCR accuracy depends on image quality. Glare, curvature, perspective, and decorative typography require broader evaluation.
- The five-second result is a development-machine measurement on synthetic fixtures, not a service-level guarantee.
- Physical font measurements cannot be conclusively derived from ordinary photographs.
- Fuzzy matching assists triage but never overrides an exact regulatory rule.
- No direct COLAs Online integration is attempted.

## Cost

The current implementation has no application runtime fee: all processing is local and the planned public host is GitHub Pages. GitHub account or organizational policies may still affect deployment availability. A future cloud-AI fallback or always-on backend would be separately evaluated and would not be enabled without an explicit budget decision.

## Next increment

1. Add CSV plus multiple-image batch intake with deterministic image-to-row matching.
2. Process a limited number of labels concurrently and preserve per-item failures.
3. Export a review summary.
4. Add distorted, rotated, low-light, and glare fixtures and publish benchmark results.
5. Add wine and malt-beverage rule modules if time permits.
