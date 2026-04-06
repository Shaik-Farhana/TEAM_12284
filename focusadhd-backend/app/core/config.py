from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    # App
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    # Supabase (Database & Auth)
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    DATABASE_URL: str
    
    # Gemini API Key (fallback if Vertex AI fails)
    GEMINI_API_KEY: str
    
    # GCP Service Account
    GCP_SERVICE_ACCOUNT_JSON: str = ""         # JSON string (for Cloud Run)
    GOOGLE_APPLICATION_CREDENTIALS: str = ""   # File path (for local dev)
    
    # Google Cloud Project Settings
    GOOGLE_CLOUD_PROJECT: str = ""
    GOOGLE_CLOUD_REGION: str = "us-central1"
    
    # Cloud Storage
    GCP_STORAGE_BUCKET: str = ""
    GCS_SIGNED_URL_EXPIRY_MINUTES: int = 60    # Signed URL TTL

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
