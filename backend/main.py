# backend/main.py

import os
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.utils.logger import log_event
from app.middleware.request_id import request_id_middleware

from app.api.admin import router as admin_router
from app.api.images import router as images_router
from app.api.patients import router as patients_router
from app.api.inference import router as inference_router
from app.api.feedback import router as feedback_router
from app.api.logs import router as logs_router
from app.api.benchmark import router as benchmark_router
from app.api.profiles import router as profiles_router
from app.api.explain import router as explain_router
from app.api import reports

from app.tasks.celery_app import celery

# ---------------------------
# ENV
# ---------------------------
load_dotenv(override=True)

logger = logging.getLogger("uvicorn")


# ---------------------------
# HELPERS (KEEP YOUR ORIGINAL LOGIC)
# ---------------------------
def get_required_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


def is_production() -> bool:
    return os.getenv("ENVIRONMENT", "development").lower() == "production"


API_PREFIX = os.getenv("API_PREFIX", "/api/v1").rstrip("/")


# ---------------------------
# STARTUP VALIDATION
# ---------------------------
async def startup_validation():
    required_envs = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "PIPELINE_VERSION",
        "ROI_DETECTOR_VERSION",
        "FEATURE_CLASSIFIER_VERSION",
        "RULE_ENGINE_VERSION",
    ]

    missing = [env for env in required_envs if not os.getenv(env)]
    if missing:
        raise RuntimeError(f"Missing environment variables: {missing}")

    host = os.getenv("HOST", "127.0.0.1")
    port = os.getenv("PORT", "8000")
    version = os.getenv("VERSION", "1.0.0")
    render_url = os.getenv("RENDER_EXTERNAL_URL")

    logger.info("===================================")
    logger.info("🚀 ThyroVision Backend Starting")
    logger.info(f"Environment : {os.getenv('ENVIRONMENT', 'development')}")
    logger.info(f"Version     : {version}")
    logger.info(f"API Prefix  : {API_PREFIX}")
    logger.info(f"URL         : {render_url or f'http://{host}:{port}'}")
    logger.info("===================================")
    logger.info(f"Pipeline    : {os.getenv('PIPELINE_VERSION')}")
    logger.info(f"ROI Model   : {os.getenv('ROI_DETECTOR_VERSION')}")
    logger.info(f"Classifier  : {os.getenv('FEATURE_CLASSIFIER_VERSION')}")
    logger.info(f"Rule Engine : {os.getenv('RULE_ENGINE_VERSION')}")
    logger.info(f"Mock Models : {os.getenv('MOCK_MODELS', 'false')}")
    logger.info("===================================")

    try:
        i = celery.control.inspect(timeout=1.0)
        nodes = i.ping() or {}
        if nodes:
            logger.info(f"Celery: ONLINE ({len(nodes)} workers)")
        else:
            logger.warning("Celery: OFFLINE")
    except Exception as e:
        logger.error(f"Celery error: {e}")
    logger.info("===================================")


# ---------------------------
# LIFESPAN
# ---------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup_validation()
    logger.info("✅ Startup complete")

    yield

    logger.info("🛑 Shutting down...")


# ---------------------------
# FASTAPI APP
# ---------------------------
app = FastAPI(
    title="ThyroVision AI Backend",
    description="""
    AI-powered thyroid ultrasound analysis system.

    ⚠️ Clinical Decision Support Tool — Not a replacement for radiologists.
    """,
    version=os.getenv("VERSION", "1.0.0"),
    lifespan=lifespan,

    docs_url=None if is_production() else "/docs",
    redoc_url=None if is_production() else "/redoc",
    openapi_url=None if is_production() else "/openapi.json",
)

# ---------------------------
# MIDDLEWARE
# ---------------------------
app.middleware("http")(request_id_middleware)

origins = os.getenv("CORS_ORIGINS", "").split(",")
origins = [o.strip() for o in origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------
# ROUTERS (VERSIONED)
# ---------------------------
app.include_router(images_router, prefix=API_PREFIX)
app.include_router(patients_router, prefix=API_PREFIX)
app.include_router(inference_router, prefix=API_PREFIX)
app.include_router(feedback_router, prefix=API_PREFIX)
app.include_router(logs_router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(benchmark_router, prefix=API_PREFIX)
app.include_router(profiles_router, prefix=API_PREFIX)
app.include_router(explain_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)


# ---------------------------
# HEALTH ROUTES
# ---------------------------
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "ok",
        "service": "ThyroVision Backend",
        "version": os.getenv("VERSION", "1.0.0"),
    }


@app.get(f"{API_PREFIX}/", tags=["Health"])
async def api_root():
    return {
        "status": "ok",
        "message": "ThyroVision API v1",
        "version": os.getenv("VERSION", "1.0.0"),
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
async def readiness():
    try:
        i = celery.control.inspect(timeout=1.0)
        nodes = i.ping() or {}
        celery_status = "online" if nodes else "offline"
    except Exception:
        celery_status = "error"

    return {
        "status": "ready",
        "celery": celery_status,
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


# ---------------------------
# FAVICON
# ---------------------------
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("favicon.ico")


# ---------------------------
# ERROR HANDLERS
# ---------------------------
@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    log_event(
        level="ERROR",
        action="VALIDATION_ERROR",
        metadata={"errors": exc.errors()},
    )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def global_error(request: Request, exc: Exception):
    status_code = getattr(exc, "status_code", 500)

    log_event(
        level="FATAL" if status_code >= 500 else "ERROR",
        action="SERVER_ERROR",
        exception=exc,
    )

    if not is_production():
        return JSONResponse(
            status_code=status_code,
            content={"detail": str(exc)},
        )

    return JSONResponse(
        status_code=status_code,
        content={"detail": "Internal Server Error"},
    )