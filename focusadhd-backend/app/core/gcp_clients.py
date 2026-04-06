"""
Centralized GCP Client Module
Resolves credentials via Application Default Credentials (ADC).
Works with:
  - authorized_user credentials (local dev via `gcloud auth application-default login`)
  - Attached service account (Cloud Run — no key file needed)
  - Service account JSON string (GCP_SERVICE_ACCOUNT_JSON env var)
"""
import json
import os
import uuid
import base64
import logging
from datetime import timedelta

import google.auth
from google import genai
from google.cloud import texttospeech, storage

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Credential Resolution (runs once at import) ──────────────────────────

_credentials = None
_project_id = settings.GOOGLE_CLOUD_PROJECT or None


def _resolve_credentials():
    """
    Resolve GCP credentials in priority order:
    1. GCP_SERVICE_ACCOUNT_JSON env var (for CI/CD)
    2. GOOGLE_APPLICATION_CREDENTIALS file (local dev — supports both
       authorized_user and service_account types)
    3. google.auth.default() — automatic (Cloud Run, gcloud CLI, etc.)
    """
    global _credentials, _project_id

    # 1. JSON string in env (rare, but supported)
    if settings.GCP_SERVICE_ACCOUNT_JSON:
        try:
            from google.oauth2 import service_account
            cred_dict = json.loads(settings.GCP_SERVICE_ACCOUNT_JSON)
            _project_id = cred_dict.get("project_id", _project_id)
            _credentials = service_account.Credentials.from_service_account_info(cred_dict)
            logger.info(f"GCP credentials loaded from JSON env var (project: {_project_id})")
            return
        except Exception as e:
            logger.error(f"Failed to parse GCP_SERVICE_ACCOUNT_JSON: {e}")

    # 2. Credentials file (authorized_user OR service_account)
    creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    if creds_path:
        creds_path = os.path.normpath(creds_path.strip('"').strip("'"))
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path

    # 3. Use google.auth.default() — handles ALL credential types automatically
    try:
        _credentials, discovered_project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        if not _project_id and discovered_project:
            _project_id = discovered_project
        # If project is still from the cred file's quota_project_id, use it
        if not _project_id and creds_path and os.path.exists(creds_path):
            try:
                with open(creds_path, "r") as f:
                    cred_data = json.load(f)
                    _project_id = cred_data.get("quota_project_id") or cred_data.get("project_id") or _project_id
            except Exception:
                pass
        logger.info(f"GCP credentials resolved via ADC (project: {_project_id}, type: {type(_credentials).__name__})")
    except Exception as e:
        logger.error(f"Failed to resolve GCP credentials: {e}")
        _credentials = None


_resolve_credentials()


# ── Client Factories ─────────────────────────────────────────────────────

def get_genai_client(use_vertex: bool = True) -> genai.Client:
    """
    Get a google-genai Client for Gemini / Imagen.
    Uses Vertex AI by default (service account or ADC auth).
    Falls back to API key if Vertex isn't available.
    """
    if use_vertex and _project_id:
        try:
            kwargs = {
                "vertexai": True,
                "project": _project_id,
                "location": settings.GOOGLE_CLOUD_REGION,
            }
            if _credentials:
                kwargs["credentials"] = _credentials
            return genai.Client(**kwargs)
        except Exception as e:
            logger.warning(f"Vertex AI client init failed, falling back to API key: {e}")

    # Fallback: API key
    if settings.GEMINI_API_KEY:
        return genai.Client(api_key=settings.GEMINI_API_KEY)

    raise RuntimeError("No Vertex AI credentials or GEMINI_API_KEY available")


def get_tts_client() -> texttospeech.TextToSpeechClient:
    """Get a Cloud Text-to-Speech client."""
    if _credentials:
        return texttospeech.TextToSpeechClient(credentials=_credentials)
    return texttospeech.TextToSpeechClient()


def get_storage_client() -> storage.Client:
    """Get a Cloud Storage client."""
    if _credentials:
        return storage.Client(credentials=_credentials, project=_project_id)
    return storage.Client(project=_project_id)


# ── GCS Upload Helper ────────────────────────────────────────────────────

def upload_to_gcs(
    data: bytes,
    prefix: str,
    content_type: str,
    extension: str = "",
) -> dict:
    """
    Upload bytes to GCS and return a URL.

    Strategy:
    1. Try signed URL (works with service accounts on Cloud Run)
    2. Try making object public (works if bucket allows it)
    3. Fall back to base64 data URI

    Returns:
        {"url": "https://...", "type": "url"}   — on success
        {"data": "<base64>", "type": "base64"}   — on fallback
    """
    bucket_name = settings.GCP_STORAGE_BUCKET
    if not bucket_name:
        logger.warning("GCP_STORAGE_BUCKET not configured — returning base64")
        return _base64_fallback(data, content_type)

    bucket_name = bucket_name.strip('"').strip("'")

    try:
        client = get_storage_client()
        bucket = client.bucket(bucket_name)
        filename = f"{prefix}/{uuid.uuid4()}{extension}"
        blob = bucket.blob(filename)
        blob.upload_from_string(data, content_type=content_type)
        logger.info(f"GCS upload OK: gs://{bucket_name}/{filename}")

        # Strategy 1: Try signed URL (works with service_account credentials)
        try:
            from google.oauth2 import service_account as sa_mod
            if isinstance(_credentials, sa_mod.Credentials):
                expiry = timedelta(minutes=settings.GCS_SIGNED_URL_EXPIRY_MINUTES)
                signed_url = blob.generate_signed_url(
                    version="v4",
                    expiration=expiry,
                    method="GET",
                )
                logger.info(f"Signed URL generated for {filename}")
                return {"url": signed_url, "type": "url"}
        except Exception as e:
            logger.debug(f"Signed URL generation skipped/failed: {e}")

        # Strategy 2: Try making the object public
        try:
            blob.make_public()
            logger.info(f"Object made public: {blob.public_url}")
            return {"url": blob.public_url, "type": "url"}
        except Exception as e:
            logger.debug(f"make_public failed (Uniform Bucket Access?): {e}")

        # Strategy 3: Return the GCS public URL pattern
        # (works if bucket has allUsers read via IAM)
        public_url = f"https://storage.googleapis.com/{bucket_name}/{filename}"
        return {"url": public_url, "type": "url"}

    except Exception as e:
        logger.error(f"GCS upload failed: {e} — falling back to base64")
        return _base64_fallback(data, content_type)


def _base64_fallback(data: bytes, content_type: str) -> dict:
    """Return base64-encoded data as a fallback."""
    encoded = base64.b64encode(data).decode("utf-8")
    return {"data": encoded, "type": "base64"}
