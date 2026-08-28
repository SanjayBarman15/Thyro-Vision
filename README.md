# ThyroVision:Thyroid Ultrasound AI System

**End-to-End Architecture & Deployment**

---

## ⚠️ Disclaimer

This system is a **clinical decision support tool** intended to assist doctors.  
It **does not replace medical diagnosis or professional judgment**.

---

## 1. System Overview

The Thyroid Ultrasound AI System analyzes thyroid ultrasound images and assists clinicians in classifying thyroid nodules using the **ACR TI-RADS classification**:

**TI-RADS Categories:** 2, 3, 4A, 4B, 4C, 5

### Key Features

- Automated TI-RADS classification
- Prediction confidence score
- Visual explainability using **Grad-CAM**
- Secure doctor authentication
- Patient record management
- Continuous learning through expert feedback

---

## 2. High-Level Architecture

```
Doctor (Browser)
      |
      v
Frontend (Next.js – Vercel)
      |
      v
Backend API (FastAPI – Docker – Render)
      |
      +---------------------------+
      |                           |
      v                           v
ML Inference Engine          Supabase
(PyTorch + ResNet)           - Auth
                             - PostgreSQL
                             - Image Storage
```

### 2.1 Folder Structure

```
project/
│
├── backend/
│   ├── app/
│   │   ├── api/                 # API routes (FastAPI/Flask)
│   │   ├── services/            # ML logic
│   │   │   ├── inference.py
│   │   │   ├── preprocessing.py
│   │   │   └── explainability.py
│   │   ├── models/              # Model configs / versioning
│   │   └── db/                  # Supabase / Postgres integration
│   │
│   ├── main.py                  # Backend entry point
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/                     # React / Next / UI code
│   └── package.json
│
├── training/
│   ├── dataset/
│   ├── utils.py
│   ├── train_model.py
│   └── evaluate.py
│
├── models/                      # Saved trained models (.pkl/.pt)
│
└── README.md
```

---

## 3. Frontend Architecture

### 3.1 Technology

- **Framework:** Next.js (React)
- **Hosting:** Vercel

### 3.2 Responsibilities

- Doctor authentication
- Patient data entry (name, age, gender, notes)
- Ultrasound image upload
- Display of:
  - TI-RADS prediction
  - Confidence score
  - Grad-CAM heatmap overlay
- Feedback submission (correct / incorrect prediction)

### 3.3 Communication

- Secure **FAST APIs (HTTPS)**
- Real-time inference response rendering

---

## 4. Backend Architecture

### 4.1 Technology

- **Language:** Python
- **Framework:** FastAPI
- **Deployment:** Docker container on Render

```
backend/
├── app/
│   ├── api/                      # API routes
│   │   ├── __init__.py
│   │   ├── patients.py           # Patient routes
│   │   ├── images.py             # Image routes
│   │   ├── inference.py          # Inference routes
│   │   ├── logs.py               # Log routes
│   │   ├── reports.py            # Report routes
│   │   └── feedback.py           # Feedback routes
│   ├── services/                 # Services
│   |    ├── inference/           # Inference services
│   |    |   ├── gradecam.py        # Grad-CAM
│   |    |   ├── roi_detector.py        # Faster R-CNN (mock now)
│   |    |   ├── feature_classifier.py  # Xception (mock now)
│   |    |   └── inference_pipeline.py         # orchestration
│   |    ├── ruleEngine/               # Rule services
│   |    |   └── tirads.py              # PURE rule engine
│   |    ├── preprocessing/
|   |    |   ├──bbox_preprocessing.py
|   |    |   └─feature_preprocessing.py   #Empty for now
|   |    |── report/
|   |    |   └── report.py
│   |    ├── explainability/      # Explainability services
│   |    |   ├── llm_client.py          # LLM client
│   |    |   ├── prompt_templates.py    # Prompt templates
│   |    |   └── response_generator.py  # Response generator
│   |    └── config/              # Model configuration
|   ├── middleware/               # Middleware
|   |   └── request_id.py         # Request ID middleware
│   ├── db/                       # Supabase integration
|   |   ├── auth.py               # Authentication functions
|   |   └── supabase.py           # Supabase client
|   └── utils/                    # Utility functions
|       ├── logger.py             # Logger
|       ├── image_utils.py        # Image utility functions
|       └── box_utils.py          # Box utility functions
├── main.py
├── Dockerfile
├── requirements.txt
└── .env
```

---

## 5. Docker Architecture

### 5.1 Purpose of Docker

Docker is used to containerize the FastAPI backend and machine learning inference pipeline to ensure:

- Reproducible and isolated runtime environments
- Consistent dependency management (PyTorch, OpenCV, Grad-CAM)
- Reliable deployment across development and production
- Simplified CI/CD and model version rollbacks

The Docker container packages the API logic, ML model weights, and explainability components into a single deployable unit.

---

### 5.2 Backend Dockerfile (FastAPI)

```dockerfile
FROM python:3.10-slim

# Ensure real-time logging
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies required for image processing
RUN apt-get update && apt-get install -y \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application and ML models
COPY app ./app
COPY main.py .
COPY models ./models

EXPOSE 8000

# Single worker is recommended for ML inference workloads
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

### 5.3 Design Considerations

- The ML model and inference pipeline are baked into the Docker image to ensure reproducibility and eliminate runtime downloads.

- A single Uvicorn worker is used to prevent model memory duplication and thread-safety issues during inference.

- The container is optimized for CPU-based inference, suitable for deployment on managed platforms such as Render.

---

## 6. Machine Learning Architecture

### 6.1 Model Design

- **Backbone:** ResNet (ImageNet pretrained)
- **Head:** Lightweight custom classification head
- **Output Classes:** 6 (TI-RADS 2 → 5)

### 6.2 Model Saving Format

- **Framework:** PyTorch
- **Format:** `.pt` (state_dict only)

```python
torch.save(model.state_dict(), "model.pt")
```

---

### 6.3 Model Response

```
{
  "tirads": 4,
  "confidence": 0.87,
  "bounding_box": {
    "x": 120,
    "y": 90,
    "width": 200,
    "height": 160
  },
  "processed_image_path": "processed/xyz.png",
  "model_version": "mock-v1",
  "inference_time_ms": 423,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## 7. Inference Pipeline

1. Receive ultrasound image
2. Image preprocessing
3. Model inference
4. Softmax confidence calculation
5. Grad-CAM heatmap generation
6. Heatmap overlay on original image
7. Upload results to Supabase Storage
8. Return prediction to frontend

---

## 8. Image Preprocessing

Implemented in `preprocessing.py`:

- Resize to model input size (e.g., 224×224)
- Normalize using ImageNet mean & std
- Convert to PyTorch tensor
- Add batch dimension

---

## 9. Grad-CAM Explainability

### 9.1 Purpose

- Highlight influential regions
- Increase clinician trust
- Enable visual verification

### 9.2 Target Layer

```python
target_layer = model.backbone.layer4[-1]
```

### 9.3 Steps

- Register forward & backward hooks
- Compute gradients for predicted class
- Weight feature maps by gradients
- Generate heatmap
- Overlay on original image

### 9.4 Outputs

- Original image
- Heatmap
- Annotated Grad-CAM image (stored in Supabase)

---

## 10. Database & Storage Architecture

### 10.1 Supabase Components

- **Auth:** Doctor authentication
- **PostgreSQL:**
  - Patient records
  - Predictions
  - Confidence scores
  - Doctor feedback
- **Storage Buckets:**
  - Original ultrasound images
  - Grad-CAM annotated images

---

## 11. Doctor Workflow

1. Doctor logs in
2. Enters patient details
3. Uploads ultrasound image
4. Backend performs inference
5. Results returned:
   - TI-RADS category
   - Confidence score
   - Grad-CAM visualization
6. Doctor reviews and submits feedback

---

## 12. Continuous Learning Pipeline

- Store expert feedback
- Filter high-quality corrections
- Curate labeled dataset
- Train new model version
- Evaluate metrics
- Deploy updated `.pt` model

---

## 13. Deployment Details

### 13.1 Backend (Render)

- **Service Type:** Docker Web Service
- **Root Directory:** `/backend`
- **Environment Variables:**
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `MODEL_VERSION`

### 13.2 Frontend (Vercel)

- Auto-deploy on GitHub push
- **Environment Variables:**
  - Backend API URL
  - Supabase public keys

---

## 📌 Final Note

This architecture prioritizes **security, explainability, and clinical usability**, ensuring the system can be safely integrated into real-world medical workflows.
