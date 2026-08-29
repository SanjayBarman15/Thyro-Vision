# ThyroVision Feedback & Curation System Documentation

This document provides a comprehensive, end-to-end technical breakdown of the **Human-in-the-Loop (HITL) Feedback & Curation System** in ThyroVision. It covers database schemas, doctor-side feedback mechanisms, automated curation triggers, admin annotation workflows, concurrency controls (claiming/locking), export architectures (Pascal VOC), and the continuous active-learning retraining cycle.

---

## 1. High-Level Architecture Overview

```
                      +---------------------------------------+
                      |   Doctor performs Ultrasound Analysis |
                      |    (Inference: Faster R-CNN + Xception) |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       Clinical Feedback Form          |
                      |   (Correct / Incorrect / Overrides)   |
                      +---------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
            [Prediction Correct]                     [Prediction Incorrect]
                     |                                         |
                     v                                         v
        +-------------------------+             +-------------------------------+
        | - Stores feedback       |             | - Stores feedback             |
        | - Updates stats/metrics |             | - Flags training_candidate    |
        +-------------------------+             | - Auto-creates 'draft' label  |
                                                +-------------------------------+
                                                               |
                                                               v
                                                +-------------------------------+
                                                |     Admin Curation Queue      |
                                                |  (Claim & Locking Mechanism)  |
                                                +-------------------------------+
                                                               |
                                                               v
                                                +-------------------------------+
                                                |     Admin Annotation Tool     |
                                                | - Bounding Box adjustments    |
                                                | - 5 ACR Feature classifications|
                                                | - Auto-computed TI-RADS score |
                                                +-------------------------------+
                                                               |
                                            +------------------+------------------+
                                            |                                     |
                                     [Admin Approves]                      [Admin Rejects]
                                            |                                     |
                                            v                                     v
                           +--------------------------------+          +--------------------+
                           | Status -> 'approved'           |          | Status ->'rejected'|
                           +--------------------------------+          | + Rejection Reason |
                                            |                          +--------------------+
                                            v
                           +--------------------------------+
                           |   Pascal VOC Dataset Export    |
                           |   (Full / Incremental ZIP)     |
                           +--------------------------------+
                                            |
                                            v
                           +--------------------------------+
                           |  Model Retraining (Colab/GPU)  |
                           |  & Benchmark Validation        |
                           +--------------------------------+
```

---

## 2. Database Schema & Data Models

### 2.1 `public.prediction_feedback`
Stores feedback directly submitted by diagnosing physicians for a specific inference result.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique record ID |
| `prediction_id` | `UUID` | `FOREIGN KEY -> predictions(id)` | Linked prediction result |
| `doctor_id` | `UUID` | `FOREIGN KEY -> doctors(id)` | Doctor who reviewed the case |
| `is_correct` | `BOOLEAN` | `NOT NULL` | True if AI matched clinical assessment |
| `corrected_tirads`| `INTEGER` | `CHECK (corrected_tirads BETWEEN 1 AND 5)`| Corrected TI-RADS level (1–5) |
| `corrected_features`| `JSONB` | Nullable | Detailed feature & bounding box adjustments |
| `comments` | `TEXT` | Nullable | Doctor's clinical observation notes |
| `created_at` | `TIMESTAMP`| `DEFAULT now()` | Timestamp of feedback submission |

#### `corrected_features` Structure:
```json
{
  "bbox_correct": false,
  "bbox_issue": "missed_nodule | false_positive | wrong_boundary | multiple_nodules",
  "bbox_hint": "Upper-left quadrant nodule missed",
  "incorrect_fields": ["composition", "margins"],
  "composition": "solid",
  "echogenicity": "hypoechoic",
  "shape": "wider than tall",
  "margin": "lobulated or irregular",
  "echogenic_foci": "punctate echogenic foci"
}
```

---

### 2.2 `public.training_labels`
The central table for data curation, active learning, and dataset generation.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unique training label ID |
| `raw_image_id` | `UUID` | `FOREIGN KEY -> raw_images(id)` | Linked ultrasound image |
| `labeled_by` | `TEXT` | `NOT NULL` (e.g. `'doctor'`) | Source of the label |
| `tirads` | `INTEGER` | `NOT NULL, CHECK (tirads BETWEEN 1 AND 5)` | Final approved/assigned TI-RADS |
| `bounding_boxes` | `JSONB` | Nullable | Nodule bounding box coordinates `[x, y, w, h]` |
| `notes` | `TEXT` | Nullable | Annotator / review notes |
| `approved` | `BOOLEAN` | `DEFAULT false` | Fast flag for approval status |
| `status` | `TEXT` | `DEFAULT 'draft' CHECK in ('draft', 'approved', 'rejected')` | Lifecycle stage |
| `claimed_by` | `UUID` | `FOREIGN KEY -> doctors(id)` | Admin currently reviewing the label |
| `claimed_at` | `TIMESTAMP`| Nullable | Timestamp when admin locked this item |
| `reviewed_by` | `UUID` | `FOREIGN KEY -> doctors(id)` | Admin who finalized review |
| `reviewed_at` | `TIMESTAMP`| Nullable | Review completion timestamp |
| `rejection_reason`| `TEXT` | Nullable | Rejection rationale if rejected |
| `corrected_features`| `JSONB` | Nullable | Final 5 ACR features after admin review |
| `metadata` | `JSONB` | Nullable | Debug/context info (AI confidence, previous bbox, etc.) |
| `exported_at` | `TIMESTAMPTZ`| Nullable | Timestamp when exported for retraining |
| `first_exported_in`| `UUID` | `FOREIGN KEY -> dataset_exports(id)` | First batch export ID |
| `created_at` | `TIMESTAMP`| `DEFAULT now()` | Creation timestamp |

---

### 2.3 `public.dataset_exports`
Tracks all dataset export bundles generated for retraining.

| Column | Type | Constraints / Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Export batch ID |
| `exported_by` | `UUID` | `FOREIGN KEY -> doctors(id)` | Admin user who triggered export |
| `exported_at` | `TIMESTAMPTZ`| `DEFAULT now()` | Generation timestamp |
| `label_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Total approved labels included |
| `image_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Total raw ultrasound images packed |
| `skipped_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Labels skipped due to validation issues |
| `export_mode` | `TEXT` | `DEFAULT 'full' CHECK in ('full', 'incremental')` | Mode of export |
| `model_version_target`| `TEXT` | Nullable | Target model iteration (e.g. `v1.2.0`) |
| `pipeline_version` | `TEXT` | Nullable | Preprocessing / ML pipeline version |
| `notes` | `TEXT` | Nullable | Description/release notes for dataset batch |

---

## 3. End-to-End Workflow

### Step 1: Doctor Diagnoses & Submits Feedback
* **Location:** `frontend/components/feedback-form.tsx` & `backend/app/api/feedback.py`
* **Route:** `POST /api/v1/predictions/{prediction_id}/feedback`
* **Workflow:**
  1. The physician reviews the AI's predicted TI-RADS class, bounding box ROI, and Grad-CAM heatmap.
  2. If the AI is correct, the doctor clicks **"Prediction is Correct"** and submits.
  3. If the AI is incorrect:
     - The doctor selects **"Prediction is Incorrect"**.
     - Modifies the TI-RADS category (TR1 – TR5).
     - Reports bounding box status (`bbox_correct = false`, selects reason: `missed_nodule`, `false_positive`, `wrong_boundary`, `multiple_nodules`).
     - Flags individual incorrect ultrasound characteristics (`composition`, `echogenicity`, `shape`, `margin`, `echogenic_foci`).
     - Adds free-text clinical notes.
  4. Backend verifies user ownership and ensures no duplicate feedback exists.
  5. Feedback is persisted to `prediction_feedback`.

---

### Step 2: Automated Curation Ingestion (Auto-Trigger)
* **Location:** `backend/app/api/feedback.py` (`create_draft_training_label`)
* **Logic:**
  When feedback is marked `is_correct: false`:
  1. **Flag Prediction:** Updates `predictions.training_candidate = true`.
  2. **Quality Filter:** Skips inference outputs with `confidence < 0.3` (prevents garbage/blank scans from contaminating training sets).
  3. **Deduplication:** Checks if a `draft` label already exists for the `raw_image_id`.
  4. **Draft Creation:** Creates a record in `training_labels` with:
     - `status = 'draft'`
     - `approved = false`
     - `tirads = doctor_corrected_tirads || ai_tirads`
     - `bounding_boxes = ai_predicted_bbox`
     - `notes = doctor_comments`
     - `metadata = { needs_bbox_correction, needs_tirads_correction, bbox_issue, ai_confidence, ai_bbox, ai_tirads, feedback_id }`
  5. The draft label enters the **Admin Curation Queue**.

---

### Step 3: Admin Curation Queue & Concurrency Locking
* **Location:** `frontend/components/admin/curation/` (`CurationClient.tsx`, `CurationQueue.tsx`, `CurationFilters.tsx`)
* **Filters:**
  - `needs_bbox`: Labels flagged where the AI bounding box was wrong.
  - `needs_tirads`: Labels flagged where the TI-RADS grade was wrong.
  - `all_draft`: All pending unreviewed items.
  - `approved`: Already approved labels.
  - `rejected`: Rejected labels.

#### Claiming & Concurrency Lock:
To prevent multiple admins from annotating the same label simultaneously:
1. When an admin clicks on a queue item to annotate:
   - Invokes RPC `claim_training_label(p_label_id, p_admin_id)`.
   - Sets `claimed_by = admin_id` and `claimed_at = now()`.
   - Other admins see this item as locked (`claimed_by` badge).
2. **Lock Expiration:**
   - Claims automatically expire after **30 minutes** of inactivity.
   - Handled via `release_expired_claims()` RPC / `POST /api/admin/curation/release-claims`.
3. **Lock Release:**
   - Unmounting the annotation page triggers `release_training_label_claim` to free up the item immediately.

---

### Step 4: Admin Interactive Annotation & TI-RADS Calculation
* **Location:** `frontend/app/admin/curation/[id]/page.tsx` & `frontend/components/admin/curation/annotation/`
* **Features:**
  1. **Dual Canvas Inspection:**
     - Displays raw ultrasound image with interactive SVG/Canvas bounding box drawing.
     - Displays Grad-CAM explainability heatmap overlay side-by-side with original AI bounding box.
  2. **ACR TI-RADS 2017 Feature Selector (`ACRFeatureForm.tsx`):**
     Admin selects standardized features from the 5 ACR criteria:

| Category | Options | Points |
| :--- | :--- | :--- |
| **Composition** | `cystic` (0), `spongiform` (0), `mixed cystic and solid` (1), `solid` (2) | 0 – 2 |
| **Echogenicity** | `anechoic` (0), `hyperechoic` (1), `hypoechoic` (2), `very hypoechoic` (3) | 0 – 3 |
| **Shape** | `wider than tall` (0), `taller than wide` (3) | 0 or 3 |
| **Margin** | `smooth` (0), `ill-defined` (0), `lobulated or irregular` (2), `extra-thyroidal extension` (3) | 0 – 3 |
| **Echogenic Foci**| `none` (0), `macrocalcifications` (1), `peripheral calcifications` (2), `punctate echogenic foci` (3)| 0 – 3 |

  3. **Deterministic Scoring Formula (`calculateTirads`):**
     $$\text{Total Points} = \sum \text{Points}(\text{selected features})$$
     - **0 to 1 point:** $\rightarrow \text{TR1}$ (Benign)
     - **2 points:** $\rightarrow \text{TR2}$ (Not Suspicious)
     - **3 points:** $\rightarrow \text{TR3}$ (Mildly Suspicious)
     - **4 to 6 points:** $\rightarrow \text{TR4}$ (Moderately Suspicious)
     - **7+ points:** $\rightarrow \text{TR5}$ (Highly Suspicious)
  4. **Validation Guard:**
     - If `needs_bbox_correction = true`, approval is blocked until a valid bounding box is drawn.
     - If `needs_tirads_correction = true`, approval is blocked until all 5 ACR features are selected.
  5. **Actions:**
     - **Approve (`Key: A`):** Calls `approve_training_label`, sets `status = 'approved'`, `approved = true`, updates `tirads`, `bounding_boxes`, `corrected_features`.
     - **Reject (`Key: R`):** Opens modal for `rejection_reason` (e.g. poor image quality, non-thyroid scan), calls `reject_training_label`.
     - **Skip (`Key: S`):** Releases claim and returns to queue.

---

### Step 5: Dataset Packaging & Pascal VOC Export
* **Location:** `backend/app/services/admin/dataset_export_service.py`
* **Route:** `POST /api/v1/admin/curation/export?mode={full|incremental}`
* **Modes:**
  - `full`: Exports all labels with `status = 'approved'`.
  - `incremental`: Exports only approved labels that have never been exported (`exported_at IS NULL`).

#### Export Output Format:
The service builds a streaming `.zip` in-memory:
```
dataset/
├── images/
│   ├── image_001.jpg
│   └── image_002.jpg
├── xmls/
│   ├── image_001.xml
│   └── image_002.xml
└── manifest.json
```

#### Pascal VOC XML Structure (`xml_utils.py`):
```xml
<annotation>
    <folder>thyroid_dataset</folder>
    <filename>image_001.jpg</filename>
    <size>
        <width>718</width>
        <height>500</height>
        <depth>3</depth>
    </size>
    <segmented>0</segmented>
    <object>
        <name>nodule</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>120</xmin>
            <ymin>85</ymin>
            <xmax>340</xmax>
            <ymax>290</ymax>
        </bndbox>
        <tirads>
            <composition>solid</composition>
            <echogenicity>hypoechoic</echogenicity>
            <shape>wider than tall</shape>
            <margins>lobulated or irregular</margins>
            <echogenic_foci>punctate echogenic foci</echogenic_foci>
            <score>8</score>
            <class>TR5</class>
        </tirads>
    </object>
</annotation>
```

#### Manifest JSON (`manifest.json`):
Contains export timestamp, export mode (`full` / `incremental`), included label count, skipped label count with reasons, pipeline version, target model version, and automated steps for Google Colab retraining.

---

### Step 6: Dataset Re-export & Model Retraining Loop

1. **Retraining:**
   - Admin downloads exported ZIP.
   - Uploads dataset into Google Drive / Cloud Bucket.
   - Runs **Faster R-CNN** fine-tuning notebook for nodule detection bounding boxes.
   - Runs **Xception** multi-task fine-tuning notebook for ACR feature extraction and TI-RADS classification.
2. **Validation & Benchmarking:**
   - Runs automated benchmark suite against standard ground-truth benchmark images (`benchmark_images` & `benchmark_runs`).
   - Evaluates IoU (Intersection over Union), bounding box accuracy, TI-RADS category accuracy, and regression checks.
3. **Deployment:**
   - Model weights (`.pth`) updated in backend environment.
   - Model performance snapshot recorded in `model_performance`.

---

## 4. Key Security & Operational Safeguards

1. **Role-Based Access Control (RBAC):**
   - Doctor endpoints (`/predictions/{id}/feedback`) verify that the calling doctor owns the original scan record.
   - Admin curation and export endpoints (`/admin/curation/*`) require administrative role (`require_admin`).
2. **Quality Gate Filtering:**
   - Predictions with AI confidence below $0.30$ are automatically omitted from generating training drafts to prevent noise accumulation.
3. **Concurrency Protection:**
   - Optimistic row-level locking via admin claims prevents multiple admins from overriding the same annotations.
   - Stale claims automatically expire after 30 minutes.
4. **Audit Trail & Logging:**
   - All feedback submissions, label approvals, claim acquisitions, and dataset export events are recorded in `system_logs` and `clinical_audit_logs`.
