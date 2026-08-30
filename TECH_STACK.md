# ThyroVision: Tech Stack Documentation

## 1. Overview & Architecture Matrix

ThyroVision utilizes a modern, resilient, high-performance tech stack split into distinct decoupled layers:
- **Presentation Layer**: Next.js 16 (React 19) web dashboard with canvas-based annotation and responsive dark-mode styling.
- **Backend API & Service Layer**: FastAPI (Python 3.10+) asynchronous REST API with structured Pydantic schemas and pipeline orchestration.
- **Machine Learning & Vision Engine**: PyTorch, Torchvision, Faster R-CNN, and Xception with Grad-CAM explainability.
- **Database & Authentication**: Supabase (PostgreSQL with Row Level Security), Supabase Auth (JWT & RBAC), and Supabase Storage.
- **Generative AI & Clinical Dialogue**: Google Gemini LLM with custom Retrieval-Augmented Generation (RAG) and counterfactual simulation.
- **Reporting & Notifications**: ReportLab for clinical PDF synthesis and Firebase Cloud Messaging (FCM) for push notifications.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THYROVISION TECH MATRIX                           │
├──────────────────────┬──────────────────────────────────────────────────────┤
│ Layer                │ Technologies                                         │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ Frontend Web App     │ Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 │
│ UI & Visualization   │ Radix UI, Lucide Icons, Framer Motion, Recharts      │
│ Canvas & Annotation  │ React-Konva, Konva.js                                │
│ State Management     │ TanStack Query v5 (React Query), Zustand             │
│ Backend API          │ FastAPI, Python 3.10+, Uvicorn, Pydantic v2          │
│ Deep Learning Engine │ PyTorch 2.x, Torchvision, timm (Xception), OpenCV    │
│ Object Detection     │ Faster R-CNN (ResNet-101 Backbone)                   │
│ Classification       │ Multi-Task Xception CNN (ACR Feature Extractor)      │
│ Explainable AI (XAI) │ Grad-CAM (Target Layer: backbone.block12)            │
│ GenAI & RAG          │ Google GenAI SDK (Gemini 2.x / Flash), Custom RAG    │
│ Database & Security  │ PostgreSQL 15+ (Supabase), Row Level Security (RLS)  │
│ Authentication       │ Supabase Auth (JWT, Role-Based Access Control)       │
│ Object Storage       │ Supabase S3-Compatible Storage Buckets               │
│ Background & Async   │ Celery, Redis / Upstash Redis, Python-Multipart      │
│ Reporting & Email    │ ReportLab (PDF Engine), Resend API                   │
│ Push Notifications   │ Firebase Admin SDK, Firebase Cloud Messaging (FCM)   │
│ DevOps & Packaging   │ Docker, Docker Compose, Pascal VOC XML Exporter      │
│ Tooling & Runtime    │ Bun, Node.js 20+, npm, Git / GitHub Actions          │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

---

## 2. Frontend Technology Stack

### 2.1 Core Framework & Language
- **Next.js 16 (App Router)**: Hybrid Server-Side Rendering (SSR) and Client-Side dynamic interactive components with optimized code-splitting and asset bundling.
- **React 19 & React DOM 19**: Modern component architecture utilizing hooks, concurrent features, and transitions.
- **TypeScript 5**: Strict static type checking across all clinical data models, API contracts, and UI components.
- **Bun / Node.js**: High-speed package management and client development environment.

### 2.2 UI Framework & Styling
- **Tailwind CSS v4 (`@tailwindcss/postcss`)**: Modern utility-first styling with custom dark-mode clinical color tokens.
- **Radix UI Primitives**: Accessible, unstyled UI primitives including:
  - `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`
  - `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-slider`
  - `@radix-ui/react-accordion`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`
- **Framer Motion (`framer-motion`)**: Smooth micro-interactions, view transitions, and animated dashboard cards.
- **Lucide React (`lucide-react`)**: Clean, standardized iconography.
- **`next-themes`**: System-aware dynamic theme switching (Dark/Light mode).

### 2.3 State Management & Data Fetching
- **TanStack React Query v5 (`@tanstack/react-query`)**: Server state synchronization, optimistic caching, automatic background refetching, and mutation management.
- **Zustand (`zustand`)**: Lightweight client-side global store for user session state, active scan selections, and temporary UI configurations.
- **React Hook Form (`react-hook-form`) & Zod (`zod`)**: Form validation and type-safe schema enforcement for patient registrations and diagnostic feedback.

### 2.4 Data Visualization & Annotation Suite
- **React-Konva (`react-konva`, `konva`)**: High-performance HTML5 Canvas rendering engine for interactive nodule bounding box annotation, dragging, resizing, and coordinate scaling.
- **Recharts (`recharts`)**: Data visualization library for longitudinal patient tracking (nodule growth curves) and admin benchmark/performance dashboards.
- **React Resizable Panels (`react-resizable-panels`)**: Split-pane layouts for synchronized side-by-side comparison of raw ultrasound scans and Grad-CAM activation overlays.

---

## 3. Backend Technology Stack

### 3.1 Framework & API Gateway
- **Python 3.10+**: Core programming language.
- **FastAPI**: Asynchronous, high-throughput REST API framework with native OpenAPI/Swagger documentation generation.
- **Uvicorn**: High-performance ASGI web server worker for asynchronous request handling.
- **Pydantic v2 & Pydantic-Settings**: Strict data validation, request/response serialization, and environment configuration management.
- **Request ID Middleware**: Distributed tracing and correlation IDs injected across all HTTP requests for audit logs.

### 3.2 Medical Document Generation & Communication
- **ReportLab (`reportlab`)**: Programmatic clinical PDF generator creating comprehensive diagnostic reports with embedded patient demographics, ultrasound scans, Grad-CAM overlays, and ACR score cards.
- **Resend (`resend`)**: Transactional email API for sending reports and urgent notifications.
- **Firebase Admin SDK (`firebase-admin`)**: Secure server-side SDK for dispatching Firebase Cloud Messaging (FCM) push notifications.

### 3.3 Asynchronous & Task Processing
- **Celery & Redis (`celery`, `redis`, `@upstash/redis`)**: Distributed asynchronous task execution for batch dataset exports, scheduled benchmark evaluations, and cleanup tasks.
- **`lxml`**: High-performance XML parser and generator for Pascal VOC annotation dataset structuring.

---

## 4. AI / Machine Learning & Computer Vision Stack

### 4.1 Deep Learning Frameworks
- **PyTorch (`torch >= 1.10.0`)**: Core deep learning tensor computation and backpropagation engine.
- **Torchvision (`torchvision >= 0.11.0`)**: Pre-trained backbones, image transformation primitives, and vision model architectures.
- **PyTorch Image Models (`timm >= 0.6.0`)**: High-performance neural network architectures, providing the specialized Xception backbone.

### 4.2 Computer Vision Models
1. **Region of Interest (ROI) Detection**:
   - **Architecture**: Faster R-CNN
   - **Backbone**: ResNet-101
   - **Task**: Bounding box localization of solitary or multiple thyroid nodules $[x_{\min}, y_{\min}, x_{\max}, y_{\max}]$.
2. **Multi-Task ACR Feature Classifier**:
   - **Architecture**: Xception Convolutional Neural Network
   - **Task**: Multi-output classification of 5 ACR TI-RADS ultrasound features:
     - Composition (Cystic, Spongiform, Mixed, Solid)
     - Echogenicity (Anechoic, Hypo/Isoechoic, Hypoechoic, Very Hypoechoic)
     - Shape (Wider-than-tall, Taller-than-wide)
     - Margin (Smooth, Ill-defined, Lobulated/Irregular, Extra-thyroidal)
     - Echogenic Foci (None, Macrocalcification, Peripheral, Punctate Microcalcification)

### 4.3 Image Processing & Preprocessing
- **OpenCV (`opencv-python-headless >= 4.5.0`)**: Fast image decoding, bounding box cropping, color conversions, and heatmap blending.
- **Pillow (PIL) (`Pillow >= 8.0.0`)**: Image ingestion, format conversion, and EXIF orientation handling.
- **NumPy (`numpy >= 1.21.0`) & Scikit-Learn (`scikit-learn >= 1.0.0`)**: Array manipulations, IoU (Intersection over Union) mathematical calculations, and confusion matrix benchmarking.

### 4.4 Explainable AI (XAI)
- **Grad-CAM (Gradient-weighted Class Activation Mapping)**: Computes gradients of the target class score with respect to convolutional feature maps in `backbone.block12` of the Xception model, producing visual spatial attention heatmaps.

### 4.5 Deterministic Rule Engine
- **Pure Python ACR TI-RADS Engine**: Standardized clinical scoring module that receives categorical feature classifications and computes:
  - Exact ACR point sum ($0 \to 14+$)
  - Final TI-RADS risk classification ($\text{TR1} \to \text{TR5}$)
  - Clinical action recommendations (FNA biopsy threshold vs. follow-up ultrasound schedule).

---

## 5. Generative AI & Clinical Dialogue (RAG)

- **Google GenAI SDK (`google-genai`)**: Integration with Google Gemini multimodal models.
- **Clinical Knowledge Base (RAG)**: Specialized retrieval over ACR TI-RADS reference literature, clinical ultrasound lexicons, and guideline documents.
- **Counterfactual Feature Simulator**: Enables clinicians to simulate "what-if" scenarios (e.g., assessing how score changes if margins were scored as lobulated instead of smooth).

---

## 6. Database, Security & Cloud Storage

### 6.1 Database (PostgreSQL / Supabase)
- **PostgreSQL 15+**: Relational database storing:
  - Patients & clinical history
  - Ultrasound image metadata
  - Model predictions & feature breakdowns
  - Doctor feedback & audit logs
  - Admin curation queues
  - Benchmark regression runs
- **Row Level Security (RLS)**: Enforces role-based data isolation between doctors, annotators, and platform administrators directly at the database engine layer.

### 6.2 Authentication & Authorization
- **Supabase Auth**: Secure JWT-based authentication supporting email/password, session refreshing, and Role-Based Access Control (RBAC).

### 6.3 Media & Object Storage
- **Supabase Storage Buckets**:
  - `ultrasound-scans`: High-resolution raw B-mode patient scans.
  - `gradcam-overlays`: Rendered Class Activation Maps.
  - `clinical-reports`: Generated PDF medical charts.

---

## 7. Deployment & DevOps Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT TOPOLOGY                                │
└─────────────────────────────────────────────────────────────────────────────┘

       Frontend (Vercel)                 Backend API (Docker / Render)
 ┌───────────────────────────┐           ┌───────────────────────────┐
 │ Next.js Production Build  │  HTTPS    │ FastAPI in Docker Container│
 │ Global Edge CDN Delivery  ├──────────►│ Python 3.10 Slim Base     │
 │ Automated GitHub CI/CD    │           │ PyTorch GPU/CPU Inference │
 └───────────────────────────┘           └─────────────┬─────────────┘
                                                       │
                                                       ▼
                                         ┌───────────────────────────┐
                                         │ Supabase Cloud Platform   │
                                         │ Managed PostgreSQL + Auth │
                                         │ S3-Compatible Storage     │
                                         └───────────────────────────┘
```

- **Containerization**: Backend packaged with a standardized multi-stage `Dockerfile` (`python:3.10-slim`, `libgl1` OpenCV system dependencies).
- **Frontend Hosting**: Vercel Edge Network with automatic build verification and preview deployments.
- **Backend Hosting**: Render / Cloud Linux VM with Docker containerization and auto-scaling.
- **Dataset Export Pipeline**: Built-in Pascal VOC XML zip packager enabling instant transfer to GPU training environments (e.g., Google Colab, RunPod, AWS SageMaker).
