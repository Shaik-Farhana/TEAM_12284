import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.cloud import texttospeech
from typing import Optional

from app.core.config import settings
from app.core.gcp_clients import get_tts_client, upload_to_gcs

router = APIRouter()
logger = logging.getLogger(__name__)


class TTSRequest(BaseModel):
    text: str
    voice_name: Optional[str] = "en-US-Neural2-J"
    speaking_rate: Optional[float] = 1.05


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """
    Convert text to speech via GCP Cloud Text-to-Speech.
    Uploads audio to GCS and returns a signed URL.
    Falls back to base64 if GCS upload fails.
    """
    try:
        # 1. Synthesize speech via Cloud TTS
        tts_client = get_tts_client()

        input_text = texttospeech.SynthesisInput(text=req.text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name=req.voice_name,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=req.speaking_rate,
        )

        response = tts_client.synthesize_speech(
            input=input_text,
            voice=voice,
            audio_config=audio_config,
        )
        audio_bytes = response.audio_content
        logger.info(f"TTS synthesis OK: {len(audio_bytes)} bytes")

        # 2. Upload to GCS and get signed URL (with base64 fallback)
        result = upload_to_gcs(
            data=audio_bytes,
            prefix="audio",
            content_type="audio/mpeg",
            extension=".mp3",
        )

        if result["type"] == "url":
            return {
                "status": "success",
                "audio_url": result["url"],
                "type": "url",
            }
        else:
            return {
                "status": "success",
                "audio_data": result["data"],
                "type": "base64",
            }

    except Exception as e:
        logger.error(f"TTS Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS Error: {str(e)}")


class ImageRequest(BaseModel):
    prompt: Optional[str] = None
    topic: Optional[str] = None


@router.post("/generate-image")
async def generate_image(req: ImageRequest):
    """
    Generate an educational illustration via Imagen 3.
    Uploads image to GCS and returns a signed URL.
    Falls back to base64 if GCS upload fails.
    """
    if not req.prompt and not req.topic:
        raise HTTPException(status_code=400, detail="Must provide prompt or topic")

    try:
        from app.agents.visual_agent import visual_agent

        actual_prompt = req.prompt
        if not actual_prompt and req.topic:
            logger.debug(f"Generating prompt for topic: {req.topic}")
            actual_prompt = await visual_agent.generate_diagram_prompt(req.topic)
            logger.debug(f"Generated prompt: {actual_prompt}")

        logger.debug("Requesting illustration from VisualAgent...")
        image_bytes = await visual_agent.generate_illustration(actual_prompt)

        if not image_bytes:
            logger.error("VisualAgent returned NO image bytes")
            raise HTTPException(
                status_code=500,
                detail="Image generation failed: VisualAgent returned no data",
            )

        logger.info(f"Image generated successfully ({len(image_bytes)} bytes)")

        # Upload to GCS and get signed URL (with base64 fallback)
        result = upload_to_gcs(
            data=image_bytes,
            prefix="images",
            content_type="image/jpeg",
            extension=".jpg",
        )

        if result["type"] == "url":
            return {
                "status": "success",
                "image_url": result["url"],
                "type": "url",
            }
        else:
            return {
                "status": "success",
                "image_data": result["data"],
                "type": "base64",
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image generation error: {str(e)}")
