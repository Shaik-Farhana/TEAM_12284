from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.errors import AppError, app_error_handler, global_exception_handler
from app.api.routes import health, sessions, learning, multimodal, users
from app import models # Ensure models are registered

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield

app = FastAPI(
    title="FocusADHD API",
    description="Multi-Agent Adaptive Learning System Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(sessions.router, prefix="/api/v1/sessions", tags=["Sessions"])
app.include_router(learning.router, prefix="/api/v1/learning", tags=["Learning"])
app.include_router(multimodal.router, prefix="/api/v1/multimodal", tags=["Multimodal"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])

@app.get("/")
async def root():
    return {"status": "ok", "service": "FocusADHD Backend", "version": "1.0.0"}
