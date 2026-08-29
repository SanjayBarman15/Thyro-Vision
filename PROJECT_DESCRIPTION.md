# Project Overview: ThyroVision

**ThyroVision** is an end-to-end, full-stack **Clinical Decision Support System (CDSS)** powered by Artificial Intelligence, designed to assist endocrinologists, radiologists, and clinicians in detecting, classifying, and managing thyroid nodules using ultrasound scans according to the international **ACR TI-RADS (American College of Radiology Thyroid Imaging Reporting and Data System)** standard.

---

## 1. The Problem ThyroVision Solves

Thyroid nodules are extremely common in the adult population (found in up to 50–60% of healthy individuals upon ultrasound screening). However, distinguishing between benign nodules and malignant thyroid cancers is challenging:
- **Inter-Observer Variability:** Different radiologists often interpret the same ultrasound scan differently.
- **Overdiagnosis & Unnecessary Biopsies:** Patients frequently undergo invasive Fine Needle Aspiration (FNA) biopsies or surgical resections for benign conditions.
- **Workflow Bottlenecks:** Manual feature scoring (composition, echogenicity, shape, margins, echogenic foci) is time-intensive and mentally taxing for clinicians.

**ThyroVision** acts as an AI pair-assistant that standardizes nodule assessment, accelerates diagnostic throughput, reduces diagnostic variability, and transparently explains its reasoning.

---

## 2. Core Capabilities & Features

### 🔍 1. Dual-Stage Deep Learning Pipeline
Rather than treating nodule assessment as a black-box image classification problem, ThyroVision uses a multi-stage clinical pipeline:
1. **Nodule Detection & Localization (Faster R-CNN):**
   - Automatically localizes Region of Interest (ROI) and identifies solitary or multiple nodule bounding boxes on B-mode ultrasound scans.
2. **Multi-Task ACR Feature Extraction & Classification (Xception / Deep CNN):**
   - Classifies the 5 standard ACR TI-RADS ultrasound features:
     - **Composition:** Cystic, spongiform, mixed cystic-solid, or solid.
     - **Echogenicity:** Anechoic, hyperechoic/isoechoic, hypoechoic, or very hypoechoic.
     - **Shape:** Wider-than-tall vs. taller-than-wide.
     - **Margin:** Smooth, ill-defined, lobulated/irregular, or extra-thyroidal extension.
     - **Echogenic Foci:** None, macrocalcifications, peripheral rim calcifications, or punctate microcalcifications.
   - Computes total ACR points to determine the final category: **TR1 (Benign)** through **TR5 (Highly Suspicious)**.

### 🧠 2. Explainable AI (XAI) with Grad-CAM
- Generates visual gradient-weighted class activation maps (**Grad-CAM heatmaps**).
- Highlights exactly which spatial regions and acoustic textures in the nodule (e.g., microcalcifications or irregular margins) drove the AI's risk prediction.
- Builds clinician trust by preventing unexplainable decisions.

### 📋 3. Longitudinal Patient & Case Management
- Secure patient registry with demographic tracking and clinical history.
- Multi-scan longitudinal tracking: compares past scans against current nodule growth over time to detect progression.
- Automated follow-up interval calculations (e.g., recommends repeat ultrasound in 12–24 months or biopsy according to ACR TI-RADS nodule size thresholds).
- Dynamic PDF clinical report generation for patient charts and referring physicians.

### 🔄 4. Human-in-the-Loop (HITL) Feedback & Active Learning
- **Doctor Feedback Loop:** Clinicians can agree with or correct AI predictions, override the TI-RADS level, and flag bounding box boundary inaccuracies directly in the app.
- **Admin Curation Pipeline:** Incorrect or disputed scans are automatically queued in an admin curation workspace.
- **Interactive Annotation Suite:** Medical annotators and administrators adjust bounding boxes, specify ACR features, and approve ground-truth labels with concurrency claim locking.
- **Dataset Export in Pascal VOC XML:** Formats curated ultrasound images and annotations for instant model retraining in Google Colab / GPU clusters.

### 📊 5. ML Performance & Benchmark Suite
- Real-time dashboards monitoring accuracy, feedback rates, confidence drift, and inference latencies.
- Automated regression testing and benchmark suite comparing model versions against curated gold-standard benchmark datasets (evaluating IoU, bounding box accuracy, and TI-RADS classification).

---

## 3. Technology Stack

| Layer | Technologies Used | Purpose |
| :--- | :--- | :--- |
| **Frontend UI/UX** | **Next.js (App Router), React, TypeScript, TailwindCSS, Lucide Icons** | High-performance, dark-mode clinical dashboard with canvas annotation tools and responsive UI. |
| **State & Data Fetching** | **TanStack React Query, Zustand** | Optimistic UI updates, caching, and state management. |
| **Backend API** | **FastAPI (Python 3.10+), Pydantic, Uvicorn** | High-throughput asynchronous REST API for inference, reporting, curation, and export services. |
| **AI / ML Engine** | **PyTorch, Torchvision, Faster R-CNN, Xception / ResNet, OpenCV, Grad-CAM** | Nodule detection, multi-label feature classification, and visual explainability. |
| **Database & Auth** | **Supabase (PostgreSQL), Supabase Auth, Row-Level Security (RLS)** | Relational schemas, stored procedures/RPCs, RBAC (Doctor vs Admin), and JWT session authentication. |
| **Storage & Media** | **Supabase Storage Buckets** | Secure, signed URL delivery for patient raw ultrasound images and Grad-CAM overlays. |
| **Containerization & Cloud**| **Docker, Render, Vercel** | Containerized backend deployment and high-availability frontend hosting. |

---

## 4. End-to-End User Flow

```
1. DOCTOR LOGIN ──► Authenticates securely via Supabase Auth (Role: Doctor)
       │
2. PATIENT CASE ──► Selects or registers patient record
       │
3. IMAGE UPLOAD ──► Uploads B-mode thyroid ultrasound scan (JPEG/PNG/DICOM)
       │
4. AI INFERENCE ──► FastAPI pipeline processes image:
                    ├─ Preprocessing & normalization
                    ├─ Faster R-CNN detects nodule bounding box
                    ├─ Xception analyzes 5 ACR features & calculates TI-RADS
                    └─ Grad-CAM generates visual heatmap
       │
5. CLINICAL REVIEW ─► Doctor reviews AI prediction, Grad-CAM overlay, and ACR score breakdown
       │
       ├──► [Agreed]    ──► Generates clinical PDF report & sets follow-up schedule
       │
       └──► [Incorrect] ──► Doctor submits feedback with clinical corrections
                                  │
                                  ▼
                         Auto-queued into Admin Curation Queue
                                  │
                         Admin annotates, verifies, and approves
                                  │
                         Exported as Pascal VOC Dataset
                                  │
                         AI Models retrained for continuous improvement
```

---

## 5. Summary

**ThyroVision** bridges the gap between state-of-the-art computer vision and real-world clinical ultrasound workflows. By pairing fast nodule detection with transparent ACR TI-RADS feature scoring, visual Grad-CAM explainability, and an active-learning curation feedback loop, ThyroVision serves as a reliable, ever-improving clinical decision support companion for physicians.
