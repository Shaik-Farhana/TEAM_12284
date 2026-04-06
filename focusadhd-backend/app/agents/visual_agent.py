import json
import os
import logging
from google import genai
from google.genai import types
from app.core.config import settings

# Setup logging
logger = logging.getLogger(__name__)

# Initialize Gemini Client
project_id = settings.GOOGLE_CLOUD_PROJECT
client = None

try:
    # 1. Try Service Account JSON String (Cloud Run / Env)
    if settings.GCP_SERVICE_ACCOUNT_JSON:
        try:
            cred_dict = json.loads(settings.GCP_SERVICE_ACCOUNT_JSON)
            project_id = cred_dict.get('project_id', project_id)
            client = genai.Client(
                vertexai=True, 
                project=project_id, 
                location=settings.GOOGLE_CLOUD_REGION,
                credentials=cred_dict
            )
            logger.info(f"VisualAgent initialized with Service Account JSON string (project: {project_id})")
        except Exception as json_err:
            logger.error(f"Failed to parse GCP_SERVICE_ACCOUNT_JSON: {json_err}")

    # 2. Try Service Account File (Local/Dev)
    if not client and settings.GOOGLE_APPLICATION_CREDENTIALS and os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS):
        try:
            with open(settings.GOOGLE_APPLICATION_CREDENTIALS, 'r') as f:
                cred_data = json.load(f)
                project_id = cred_data.get('project_id', project_id)
            client = genai.Client(
                vertexai=True, 
                project=project_id, 
                location=settings.GOOGLE_CLOUD_REGION
            )
            logger.info(f"VisualAgent initialized with Vertex AI credentials file (project: {project_id})")
        except Exception as file_err:
            logger.error(f"Failed to initialize with credentials file: {file_err}")

    # 3. Fallback to default auth or API Key
    if not client:
        if os.getenv('K_SERVICE'): # Only on Cloud Run
            client = genai.Client(vertexai=True, project=project_id, location=settings.GOOGLE_CLOUD_REGION)
            logger.info(f"VisualAgent using Cloud Run Default Service Account (project: {project_id})")
        else:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            logger.info("VisualAgent fallback to Gemini API Key")

    # Final check for aio attribute
    if client and not hasattr(client, 'aio'):
        logger.warning("VisualAgent: Client object missing 'aio' attribute. Async operations will fail.")

except Exception as e:
    logger.error(f"Critical error during VisualAgent client initialization: {e}")
    if not client:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("VisualAgent last-resort fallback to API Key")

class VisualAgent:
    async def generate_diagram_prompt(self, context: str) -> str:
        return f"A clean, educational, high-contrast flat-design illustration of: {context}. professional style, white background."

    async def generate_illustration(self, prompt: str) -> bytes:
        """
        Generates an image using Imagen 3.
        Tries async first, then falls back to synchronous calls.
        """
        # 1. Try Async Plural
        try:
            if hasattr(client.aio.models, 'generate_images'):
                logger.info("VisualAgent: Attempting async generate_images (plural)")
                response = await client.aio.models.generate_images(
                    model="imagen-3.0-generate-001",
                    prompt=prompt,
                    config=types.GenerateImagesConfig(number_of_images=1, output_mime_type="image/jpeg")
                )
                if response.generated_images:
                    return response.generated_images[0].image.image_bytes
        except Exception as e:
            logger.warning(f"VisualAgent: Async generate_images failed: {e}")

        # 2. Try Sync Plural (via thread)
        try:
            import asyncio
            if hasattr(client.models, 'generate_images'):
                logger.info("VisualAgent: Attempting sync generate_images (plural) fallback")
                # Run in thread to not block event loop
                response = await asyncio.to_thread(
                    client.models.generate_images,
                    model="imagen-3.0-generate-001",
                    prompt=prompt,
                    config=types.GenerateImagesConfig(number_of_images=1, output_mime_type="image/jpeg")
                )
                if response.generated_images:
                    return response.generated_images[0].image.image_bytes
        except Exception as e:
            logger.error(f"VisualAgent: Sync generate_images failed: {e}")

        # 3. Final Diagnostic
        logger.error(f"VisualAgent: All image generation attempts failed. Models attributes: {dir(client.models)}")
        return None

visual_agent = VisualAgent()
