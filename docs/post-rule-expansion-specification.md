# SODAPOP post-rule-expansion specification

Status: **Approved; routing foundation plus distilled-spirits and wine card expansions implemented. Malt-beverage cards remain pending.**

This specification converts the approved TTB rule-family catalog into machine-readable records. Its records now drive the routing foundation, rule-set transparency, and expanded domestic/imported distilled-spirits and wine reviewer cards.

## Scope and authority

SODAPOP remains TTB reviewer-side decision support for COLA review. It does not create a new industry submission process and does not implement FDA or CBP compliance systems.

The specification uses:

- TTB F 5100.31 and COLAs Online data for application and routing facts;
- approved formulas and their labeling instructions for product identity, composition, and conditional disclosures;
- permits, Brewer's Notices, and supporting documents for responsible-party and production facts;
- all submitted label artwork and documented container markings for label evidence; and
- current TTB guidance and the cited CFR provisions as regulatory authority.

Wine below 7 percent alcohol by volume receives a TTB jurisdiction-routing result. The app must explain that Part 4 COLA review does not apply, retain any applicable TTB Part 16/24 routing information, and avoid implementing FDA rules.

## Machine-readable contract

The authoritative specification is in `src/domain/ruleSpecification.ts`.

Each rule record contains:

- a stable rule ID;
- beverage category;
- reviewer-facing title;
- concise requirement;
- regulatory authorities;
- structured applicability conditions;
- required review facts;
- authoritative evidence sources;
- proposed analysis steps;
- explicit missing-context behavior; and
- confirmation that the result becomes a reviewer Pass/Fail card.

Each review fact has a corresponding application-data record identifying its source and purpose. Each rule set lists its base and conditional rule IDs.

Missing applicability data is an **unknown**, not `false`. The future routing engine must never omit a rule merely because an expected fact is absent.

## Defined rule sets

1. Distilled spirits — Domestic
2. Distilled spirits — Imported
3. Wine 7% or more — Domestic
4. Wine 7% or more — Imported
5. Wine below 7% — TTB routing
6. Malt beverage — Domestic
7. Malt beverage — Imported

The base rule set is selected from product type, source, and—in the wine branch—alcohol content. Formula, composition, ingredient, claim, and production facts activate conditional rules within the selected set.

The rule-set label describes the regulatory branch, not merely a beverage name. For example, `Wine 7% or more — Imported` is distinct from both domestic wine and the under-7% routing branch.

## Recommendation behavior

For every applicable rule, SODAPOP must attempt a best-supported recommendation:

- **Pass recommendation:** available evidence supports the requirement.
- **Fail recommendation:** available evidence shows a missing, conflicting, or noncompliant element.
- **Insufficient evidence:** reserved for genuinely missing context, absent artwork, or evidence that cannot be read reliably.

“Insufficient evidence” is not a permanent human-review designation for a class of rules. The app should still report everything it could establish and explain exactly what prevented a stronger recommendation. Staff must mark every applicable card Pass or Fail.

## Future rule-set control

The selected rule set will appear as a compact, clickable control in the sticky compliance-determination bar, in the open area identified by the project owner. A suitable label is:

> Rules: Distilled spirits — Domestic

The control must remain visible while the cards scroll.

### Quick inspection

Activating the control by mouse, keyboard, or touch opens a lightweight dialog or popover showing:

- the selected rule-set name;
- why it was selected, such as `Product type: Distilled spirits` and `Source: Domestic`;
- selection confidence and any missing routing facts;
- the currently applicable rules, with conditional rules clearly identified;
- the most likely alternative rule sets at the top; and
- actions to change the rule set or open its full details.

Hover may show a short description for pointer users, but no required information or action may depend on hover.

### Full rule-set reference

`Open full rule set` opens a dedicated, read-only browser window or tab at a stable route such as:

`/SODAPOP/rules/:rule-set-id`

That reference view lists each rule's requirement, applicability, evidence sources, and authority. It remains open independently so a reviewer can compare it with the active review.

### Manual override

The reviewer may choose another rule set. Before reanalysis, SODAPOP must show:

- the current automatically selected set;
- the requested replacement;
- the major routing facts that support or conflict with that choice; and
- a clear `Apply rule set and reanalyze` action.

After confirmation:

1. Store the automatic selection, manual selection, time, and reviewer action in the review audit data.
2. Reuse cached OCR text, word coordinates, image preprocessing, application facts, and formula facts.
3. Re-evaluate applicability and every affected card against the replacement set.
4. Run only a targeted additional evidence pass if the replacement introduces evidence that the cached analysis did not extract.
5. Clear unsubmitted staff determinations for cards whose rule identity or evidence changed.
6. Preserve a submitted decision as an immutable earlier revision if the override occurs during a correction workflow.
7. Display `Reviewer-selected rule set` until the reviewer restores automatic selection.

The reviewer can return to the automatically recommended set with `Use automatic selection`.

## Five-second performance protection

Rule-set selection must not extend the primary analysis path materially:

- Select the default rule set synchronously from already available structured facts.
- Do not rank or prepare alternative rule sets during initial analysis.
- Load and rank alternatives only after the reviewer activates the rule-set control.
- Run OCR once and retain its text, coordinates, preprocessing metadata, and confidence.
- On override, rerun rule evaluation against cached evidence rather than repeating OCR.
- Use a targeted OCR/image pass only if a newly selected rule needs evidence not present in the cache.
- Measure initial analysis and override reanalysis separately; both target completion within five seconds.

The static rule records are small and may ship with the application. Lazy behavior applies to alternative ranking, detailed reference presentation, and any additional evidence work—not to the selected rule's correctness.

## Original acceptance criteria before routing implementation

- Every rule ID is unique.
- Every required fact exists in the application-data specification.
- Every applicability condition references a defined fact.
- Every rule has at least one regulatory authority, evidence source, evaluation step, and missing-context instruction.
- Every rule-set reference resolves to a defined rule.
- Every rule belongs to at least one rule set unless it is intentionally documented as a detected-claim subrule.
- Base rule selection depends only on product type, source, and wine ABV.
- Missing routing facts are surfaced rather than interpreted as “does not apply.”
- All applicable findings remain subject to staff Pass/Fail confirmation.
- No routing engine or reviewer-interface behavior changes until this specification is approved.

## Implementation sequence after approval

1. Completed — tri-state applicability evaluator: applies, does not apply, or missing context.
2. Completed — automatic base rule-set selection and ranked alternatives.
3. Completed — expanded distilled-spirits review-packet contract.
4. Completed — domestic/imported distilled-spirits checks and regression cases without changing the staff decision rule.
5. Completed — sticky rule-set control, detail dialog, full reference route, override, and cached reanalysis.
6. In continuous validation — five-second budget on clear and difficult images.
7. Completed — domestic/imported wine engines at 7% alcohol or more, including conditional appellation, varietal, vintage, estate, formula, sulfite, color-additive, origin, and foreign-blend rules.
8. Completed — the domestic below-7% TTB branch, including applicable Part 24 label information and the Part 16 health warning without implementing FDA rules.
9. Pending — malt-beverage rule engine in reviewed increments.
