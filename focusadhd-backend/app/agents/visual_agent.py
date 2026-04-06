import logging
from google.genai import types
from app.core.gcp_clients import get_genai_client

logger = logging.getLogger(__name__)

# Initialize Vertex AI client via centralized module
client = get_genai_client(use_vertex=True)


class VisualAgent:
    async def generate_diagram_prompt(self, context: str) -> str:
        return f"A clean, educational, high-contrast flat-design illustration of: {context}. professional style, white background."

    async def generate_illustration(self, prompt: str) -> bytes:
        """
        Generates an image using Imagen 3 via Vertex AI.
        Tries async first, then falls back to synchronous calls.
        """
        # 1. Try Async (plural — generate_images)
        try:
            if hasattr(client.aio.models, "generate_images"):
                logger.info("VisualAgent: Attempting async generate_images")
                response = await client.aio.models.generate_images(
                    model="imagen-3.0-generate-001",
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1, output_mime_type="image/jpeg"
                    ),
                )
                if response.generated_images:
                    return response.generated_images[0].image.image_bytes
        except Exception as e:
            logger.warning(f"VisualAgent: Async generate_images failed: {e}")

        # 2. Try Sync (via thread to not block event loop)
        try:
            import asyncio

            if hasattr(client.models, "generate_images"):
                logger.info("VisualAgent: Attempting sync generate_images fallback")
                response = await asyncio.to_thread(
                    client.models.generate_images,
                    model="imagen-3.0-generate-001",
                    prompt=prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=1, output_mime_type="image/jpeg"
                    ),
                )
                if response.generated_images:
                    return response.generated_images[0].image.image_bytes
        except Exception as e:
            logger.error(f"VisualAgent: Sync generate_images failed: {e}")

        # 3. All attempts failed
        logger.error(
            f"VisualAgent: All image generation attempts failed. "
            f"Models attrs: {dir(client.models)}"
        )
        return None


visual_agent = VisualAgent()
