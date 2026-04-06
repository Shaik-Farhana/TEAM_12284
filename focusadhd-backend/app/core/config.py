from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    # App
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    # Supabase (will be read from .env)
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    DATABASE_URL: str
    GEMINI_API_KEY: str
    
    # GCP Keys
    GCP_API_KEY: str = ""
    GCP_STORAGE_BUCKET: str = ""
    GCP_SERVICE_ACCOUNT_JSON: str = ""
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    
    # Google Cloud / Vertex AI Defaults
    GOOGLE_CLOUD_PROJECT: str = "capstone-491520" 
    GOOGLE_CLOUD_REGION: str = "us-central1"
    
    # Storage
    SUPABASE_STORAGE_BUCKET: str = "learning-content"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
