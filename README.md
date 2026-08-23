# LabelEvidence

LabelEvidence is an evidence-led alcohol label review prototype. It compares product application information with actual label artwork and the requirements that apply to that product, then directs unresolved questions to a human reviewer.

**Live demonstration:** [https://beelybuttons.github.io/LabelEvidence/](https://beelybuttons.github.io/LabelEvidence/)

## Current demonstration

- 56 independent application-and-image cases
- 42 cases created without a planted issue and 14 with varied planted issues; OCR and routed requirements determine the runtime result
- Domestic and imported wine, distilled spirits, and malt beverages
- Separate wine profiles above and below 7% alcohol by volume
- A saved, randomized first-in-first-out queue
- Individual review and simulated batches from three through seven labels
- A category-balanced optional batch of 40
- Reviewer-started OCR and image analysis that continues in queue order
- Separate concerns for unresolved or conflicting requirements
- Human confirmation or dismissal of every AI-generated concern
- Human disagreement controls for checks the AI cleared
- Explicit approve or return-for-correction decisions
- Reviewer-attested bulk approval for clear labels in a batch
- Completed-decision history with the ability to review and change a saved decision
- Image-viewing controls for zoom, rotation, brightness, and contrast
- An applicant-facing Domestic Distilled Spirits prescreen with editable application information and a secure label-image upload

### Review profiles

1. Domestic wine at or above 7% ABV
2. Imported wine at or above 7% ABV
3. Domestic wine under 7% ABV
4. Imported wine under 7% ABV
5. Domestic distilled spirits
6. Imported distilled spirits
7. Domestic malt beverages
8. Imported malt beverages

Each profile contains seven cases.

## Approach

LabelEvidence uses the application to determine what the label must prove. Its review process is:

1. Read the application and supporting product information.
2. Select applicable requirements using factors such as beverage type, domestic or imported status, alcohol content, ingredients, formula information, and other product characteristics.
3. Convert each applicable requirement into a specific evidence question.
4. Use OCR and image analysis to examine the actual label image.
5. Compare information found in the image with the application and required disclosures.
6. Inventory and evaluate optional statements and claims separately.
7. Create one human-review concern for each missing, uncertain, or conflicting requirement.
8. Allow the reviewer to confirm or dismiss concerns and make the final approve-or-return decision.

The interface emphasizes exceptions. When a label requires human attention, the reviewer sees what could not be verified or what appears inconsistent rather than a large collection of cards describing everything that passed.

## How to use LabelEvidence

### 1. Enter the prototype

The homepage explains the relationship between application information, applicable requirements, image analysis, and human review. Select **Go to LabelEvidence** to open the active review queue.

### 2. Understand the active queue

The queue contains individual applications and simulated batches. Each row shows its position, application and product category, AI-analysis status, human-decision status, and review action.

The first review units are individual labels. The first batch contains five labels. Later batches contain between three and seven labels. An additional category-balanced batch of 40 is available from the navigation menu.

### 3. Start AI analysis

Select **Begin AI analysis**. Until then, every application remains marked as not yet evaluated.

Analysis runs locally in the browser and proceeds through the saved queue. Human review can begin as soon as the first result is ready; it is not necessary to wait for every label to finish.

### 4. What the AI does in the background

For each application, LabelEvidence:

1. Reads the application and supporting product information.
2. Selects the applicable requirements.
3. Turns those requirements into evidence questions.
4. Retrieves the label image associated with the demonstration application.
5. Uses OCR and image analysis to read the label pixels.
6. Compares image evidence with application values and required disclosures.
7. Separately inventories optional statements and claims.
8. Records OCR confidence and processing time.
9. Creates one human-review concern for each unresolved or conflicting requirement.

Image uncertainty is treated separately from a readable compliance conflict. Difficulty reading something does not automatically mean the label is noncompliant.

### 5. Open a label for human review

Select **Review label** for an evaluated application, or select **Begin or resume human review** to proceed through the queue in order.

The review screen places the submitted label image beside the AI findings and final-decision controls. Application information and supporting evidence can be opened beneath the image for comparison.

### 6. Adjust the image

Open **Edit / enhance image** above the submitted label. The reviewer can:

- Zoom in or out
- Adjust brightness
- Adjust contrast
- Rotate the image left or right
- Reset the image to its original viewing settings

These controls help the reviewer inspect difficult text or orientation. They do not alter or replace the submitted evidence.

### 7. Confirm or dismiss AI-generated concerns

Each concern explains what was checked, the relevant application value, what the AI found or could not find, and why human attention is needed.

- Select **Confirm concern** when the AI identified a genuine issue.
- Select **Dismiss concern** when the label is acceptable and the AI concern is a false alarm or does not require correction.

Every AI concern must be addressed before a final decision can be confirmed.

### 8. Disagree when the AI cleared something

A label with no detected concerns displays **No AI concerns detected**, but the human remains in control. Open **View complete review** to see every comparison.

Select **Disagree** beside a cleared check if the AI marked it as verified but the reviewer sees a problem. A human disagreement prevents approval and allows the label to be returned for correction. The disagreement can also be undone.

### 9. Make the final human decision

After reviewing the image and addressing every concern, select:

- **Approve label** when the evidence supports approval.
- **Return for correction** when the application or label requires correction.

“Return for correction” is used because the applicant may be able to correct the problem and submit revised materials. A reviewer note may be required to explain what must be corrected.

The choice remains a draft until the reviewer selects **Confirm and proceed to next label**.

### 10. Use the batch-review screen

When human review reaches a batch, LabelEvidence opens a batch overview with two groups:

- **Human attention required:** Labels with possible concerns appear first and must be reviewed individually.
- **No AI concerns detected:** Clear labels appear below and can be opened individually or considered for bulk approval.

The screen shows how many applications in the batch have completed human decisions. When every decision is confirmed, select **Continue to next queue item**.

### 11. Bulk approve clear labels

Only labels for which LabelEvidence detected no concerns can be bulk approved. The reviewer must affirm that the labels were reviewed and that approval is authorized. After making that affirmation, select **Approve these clear labels**.

Labels containing potential concerns cannot be included and remain subject to individual review.

### 12. View and reconsider completed reviews

Select **Completed reviews** from the navigation menu. Confirmed decisions leave the active queue and appear here with the decision, AI result, reviewer note, and saved date.

Select **Review again** to reopen a completed label. Select **Change saved decision** to reconsider and explicitly confirm an amended decision.

### 13. Reset and start over

Select **Reset all data** to clear the saved queue order, analysis state, reviewer decisions, notes, and batch notices. The browser requests confirmation before creating a fresh queue and returning the demonstration to its starting state.

## Applicant prescreen

Select **Applicant prescreen** from the navigation menu to open the applicant-facing demonstration.

This page demonstrates how LabelEvidence could help applicants identify possible omissions, conflicts, and unsupported statements before submission. The goal is to reduce avoidable problems and give applicants an opportunity to make adjustments before waiting for an official review.

The prescreen is configured for a **Domestic Distilled Spirits** application with editable, pre-filled information. An applicant can:

1. Review or change the sample application values.
2. Upload a PNG or JPEG image of a label.
3. Select **Prescreen this label**.
4. Review potential concerns and the complete list of checks.

The image is processed locally in the browser. The prototype checks its internal signature, reported type, size, and dimensions. It rejects unsupported or renamed files and safely re-encodes accepted images before OCR.

The prescreen is advisory. It does not submit an application, issue a COLA, guarantee approval, or replace an official TTB review.

## Image enhancement and AI reference images

LabelEvidence demonstrates that image-enhancement controls can be made available directly to reviewers. The current controls include zoom, rotation, brightness, and contrast.

This capability could also become part of the AI image-analysis process. The AI could scan an imperfect photograph and generate a clean, idealized reference image representing its interpretation of the label it read. Such a reference could help a reviewer understand the AI’s interpretation of difficult text, orientation, layout, low-contrast areas, distorted artwork, and the location of required statements or optional claims.

The generated image would not be presented as a perfect copy of the real label. It would be an AI interpretation and could contain mistaken letters, reconstructed wording, or invented visual details. Therefore:

- The original submitted image would always remain available.
- The generated reference would be clearly marked as AI-generated.
- The reviewer could compare it directly with the original.
- It would be reference material, not replacement evidence.
- Regulatory conclusions would remain tied to the original image.
- Any uncertain reconstruction would become a human-review question rather than an automatic compliance finding.

This demonstrates how future image-enhancement technology could help explain what the AI believes it saw while preserving the original evidence and the reviewer’s authority.

## Tools used

- React and TypeScript for the interface and review workflow
- Vite for development and production builds
- Tesseract.js for browser-based OCR
- Browser image processing for normalization, resizing, orientation handling, viewing adjustments, and secure re-encoding
- A rules-based evidence engine for selecting applicable requirements and comparing application information with image evidence
- Browser local storage for preserving the demonstration queue, notes, and reviewer decisions
- Vitest and Testing Library for automated verification
- Git and GitHub for version control and public source-code delivery

OCR runs locally in the browser. The demonstration does not require a cloud machine-learning service to read the supplied labels.

## Assumptions and prototype boundaries

- LabelEvidence is a decision-support prototype, not an official TTB system.
- It does not issue a COLA or make legally binding approval decisions.
- The rule set demonstrates the architecture and important review conditions but is not a complete implementation of every TTB, FDA, CBP, USDA, or other regulatory requirement.
- Production rules would require authoritative sources, effective dates, version management, and validation by qualified regulatory experts.
- Demonstration applications and labels are synthetic and contain no real applicant information.
- OCR performance depends on image quality, typography, layout, and the reviewer’s computer.
- OCR uncertainty is not automatically treated as noncompliance.
- AI-generated reference images would not replace original submitted artwork.
- Applicant-prescreen results are advisory and do not guarantee official approval.
- Browser-local image protections are suitable for this demonstration. A production service would also require server-side validation, malware scanning, authentication, rate limiting, encrypted storage, retention controls, and auditing.
- Processing commonly takes a few seconds for the demonstration labels, but performance has not been established for every computer or a broad collection of real-world photographs.
- The prototype does not connect to COLAs Online or other internal TTB systems.

## Local setup and run instructions

Requirements: a current Node.js installation with npm.

```bash
git clone https://github.com/BeelyButtons/LabelEvidence.git
cd LabelEvidence
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

The automated suite verifies the case distribution, runtime data boundaries, queue and batch behavior, routed requirements, OCR evidence comparisons, concern resolution, passed-check disagreements, bulk approval safeguards, explicit final-decision confirmation, completed-review reopening, editable applicant information, defensive image-header validation, and the underlying rule engine. Real OCR behavior is additionally checked in the running browser.
