# LabelEvidence reviewer case-file specification

Status: **Foundation and twelve-case guarded pilot implemented; full-queue integration deferred.**

## Purpose

LabelEvidence must review a COLA case, not treat a label image as the entire case. The label is one evidence source within a packet that also contains applicant authorization, an authoritative product determination, supporting documents, container information, and review history.

This specification applies across distilled spirits, wine, and malt beverages. Commodity-specific rules remain separate, but all three use the same evidence model and decision language.

## Safety and rollout

- Preserve the current results screen and current `ApplicationData` contract.
- Add the case-file model alongside the current review path.
- Do not make the new model the default until representative cases and the reviewer presentation are approved.
- Do not remove the current results implementation during this phase.
- Keep each phase as a separate Git rollback point.

## Evidence principle

Application statements are assertions, not proof. Agreement between an application field and label text establishes consistency only. It does not establish that the underlying product, origin, age, method, or certification claim is true.

Every material determination must retain:

- the requirement or claim being evaluated;
- the evidence source;
- whether that source supports, contradicts, or does not resolve the matter;
- the source's authority level;
- the document or record reference; and
- the resulting reviewer disposition.

The authority levels are:

1. `applicant_assertion` — an application entry, note, or unsupported representation;
2. `supporting_record` — a producer letter, production record, certificate, laboratory report, or other substantiation; and
3. `authoritative_determination` — an approved TTB formula, TTB laboratory determination, permit/registry result, certifier-approved organic label, or other controlling determination.

An applicant assertion alone cannot resolve a claim that requires substantiation.

## Case-file sections

### Application snapshot

The application snapshot records what the applicant submitted, including product and source, application type, applicant identity, brand, fanciful name, alcohol content, net contents, wine claims, formula reference, resubmission reference, and notes to the specialist.

### Applicant authorization

This section represents the result of checking the applicant against the relevant plant registry, basic permit, Brewer's Notice, approved trade names, filing locations, and authorized operations. The ordinary reviewer result should be concise (`verified`, `not_verified`, or `conflict`); raw permit documents do not need to dominate the label-review interface.

### Product determination

This section establishes the product's authoritative identity. When pre-COLA evaluation is required, it records the approved formula or laboratory determination, approved class/type, statement of composition, mandatory disclosures, labeling instructions, approval conditions, and whether the determination applies to this applicant and product.

Underlying formula evidence can include a recipe and method, foreign producer letter, Flavor Ingredient Data Sheets, Limited Ingredient Calculation Worksheets, specification sheets, laboratory results, and referenced base formulas. The label-review interface should normally present the resulting determination and instructions, while retaining links to the underlying evidence.

### Supporting evidence

Supporting evidence is claim-driven rather than universally required. Examples include:

- organic certifier label approval;
- age or origin certification;
- natural wine certification;
- analytical results supporting alcohol, sugar, calorie, or gluten statements;
- production and sourcing records for vintage, varietal, appellation, estate, aging, barrel, ingredient, or process claims;
- foreign producer letters and translations; and
- distinctive liquor bottle photographs or other container evidence.

Import/customs evidence must retain its stage. A document required for customs release is not automatically represented as a document reviewed in every COLA application.

### Label package

The package records every submitted label panel, its role, dimensions, container capacity, container markings, translations, and any physical-container evidence. OCR output is derived evidence and never replaces the submitted artwork.

Image analysis may identify potential text, contrast, or layout concerns. It cannot conclusively determine physical type size without reliable printed dimensions and container information.

### History

The history records prior applications, rejected-application references, correction requests, resubmissions, existing COLAs, reviewer overrides, and later revisions. Previous approval may be relevant to history or allowable revisions but is not proof that a new or changed claim is compliant.

## Packet readiness outcomes

Packet readiness is separate from final label compliance:

- `cannot_review` — a required label package, applicant authorization, or required pre-COLA determination is missing or unusable;
- `needs_correction` — authoritative evidence contradicts the application or a material label claim;
- `needs_evidence` — a claim requiring substantiation has no qualifying evidence;
- `ready_for_label_review` — the packet is sufficient to run the applicable label rules; this is not an approval;
- final label results remain `approve`, `approve_with_qualification`, `needs_correction`, or `reject` as supported by the governing procedure.

Electronic applications that are correctable should ordinarily be presented as `Needs Correction`, not as finally rejected. Final rejection is a final agency disposition, including when required corrections are not made within the permitted period.

## Reviewer sequence

1. Confirm jurisdiction, filing type, applicant authorization, and packet completeness.
2. Establish the authoritative product identity and required disclosures.
3. Identify claims and determine which require supporting evidence.
4. Compare the application and complete label package with the authoritative records.
5. Apply commodity-specific content, placement, legibility, and prohibited-practice rules.
6. Produce a small number of grouped tasks with the evidence and legal basis available on demand.

OCR uncertainty must not create a compliance finding. If image evidence cannot resolve several visual questions, group them under one image-evidence task. Document conflicts remain separate findings.

## Synthetic data requirements

Synthetic cases must contain no real confidential formula or permit data. Each case should deliberately model one or more of the following:

- a fully reviewable packet;
- missing authorization;
- missing required formula approval;
- formula/application/label conflict;
- unsupported claim;
- supporting evidence that resolves a claim;
- contradictory evidence;
- incomplete label panels or translations; and
- correction/resubmission history.

The pilot contains twelve mapped cases: domestic standard and specialty spirits; imported protected spirits; exemption/distinctive-bottle review; domestic wine claims; domestic specialty wine; imported wine; wine below 7 percent; ordinary and specialty domestic malt beverages; imported bottled malt beverages; and imported malt beverages packaged in the United States.

## Public authority baseline

- TTB F 5100.31: https://www.ttb.gov/media/70320/download?inline=
- COLAs Online application instructions: https://www.ttb.gov/system/files?file=images%2Fpdfs%2Flabeling_colas-docs%2Fcreate-an-application.pdf
- 27 CFR part 13: https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-13
- TTB formula approval basics: https://www.ttb.gov/regulated-commodities/formulation/approval-basics
- TTB FID sheet guidance: https://www.ttb.gov/regulated-commodities/formulation/fid-sheet-guidance-and-examples
- TTB wine labeling: https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/labeling
- TTB distilled spirits labeling: https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/labeling
- TTB malt beverage mandatory information: https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/malt-beverage-mandatory-label-information
- TTB organic claims: https://www.ttb.gov/alfd/alcohol-beverages-labeled-with-organic-claims
- TTB age and origin certificates: https://www.ttb.gov/import-export/itd/certificate-of-age-and-origin-requirements-for-imported-alcohol-beverages

## Deferred work

This phase does not change the application form, results screen, OCR pipeline, or existing rule outcomes. A reviewer-facing packet summary is available at the isolated `/case-files` route using twelve synthetic cases mapped to existing label scenarios. Review-ready packets may continue to the matching existing label review; cases needing evidence, correction, or a required document stop before that handoff. Only after hands-on approval should the case-file model be expanded across the full queue.
