import os
import uuid
import base64
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.cloud import texttospeech, storage
from typing import Optional
from app.core.config import settings

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice_name: Optional[str] = "en-US-Neural2-J"
    speaking_rate: Optional[float] = 1.05

@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """
    Convert text to speech via GCP TTS.
    Attempts to upload to GCS and return a public URL.
    Falls back to returning base64 audio data if GCS upload fails.
    """
    gcp_key = settings.GCP_API_KEY
    bucket_name = settings.GCP_STORAGE_BUCKET
    creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS

    # Normalize the path to handle Windows backslash issues
    if creds_path:
        creds_path = os.path.normpath(creds_path.strip('"').strip("'"))
    if bucket_name:
        bucket_name = bucket_name.strip('"').strip("'")

    if not gcp_key:
        raise HTTPException(status_code=500, detail="GCP_API_KEY not configured")

    try:
        print(f"TTS Start: bucket={bucket_name}, creds={creds_path}")

        # 1. Generate Speech via TTS
        if settings.GCP_SERVICE_ACCOUNT_JSON:
            cred_dict = json.loads(settings.GCP_SERVICE_ACCOUNT_JSON)
            tts_client = texttospeech.TextToSpeechClient.from_service_account_info(cred_dict)
        elif creds_path and os.path.exists(creds_path):
            tts_client = texttospeech.TextToSpeechClient.from_service_account_json(creds_path)
        else:
            tts_client = texttospeech.TextToSpeechClient(
                client_options={"api_key": gcp_key}
            )

        input_text = texttospeech.SynthesisInput(text=req.text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name=req.voice_name
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=req.speaking_rate
        )

        response = tts_client.synthesize_speech(
            input=input_text,
            voice=voice,
            audio_config=audio_config
        )
        audio_bytes = response.audio_content
        print(f"TTS synthesis OK: {len(audio_bytes)} bytes")

        # 2. Try to Upload to GCS (optional - fallback to base64 if it fails)
        if bucket_name:
            try:
                if settings.GCP_SERVICE_ACCOUNT_JSON:
                    cred_dict = json.loads(settings.GCP_SERVICE_ACCOUNT_JSON)
                    storage_client = storage.Client.from_service_account_info(cred_dict)
                elif creds_path and os.path.exists(creds_path):
                    storage_client = storage.Client.from_service_account_json(creds_path)
                else:
                    # Fallback to default auth if on Cloud Run
                    storage_client = storage.Client()

                bucket = storage_client.bucket(bucket_name)
                filename = f"audio/{uuid.uuid4()}.mp3"
                blob = bucket.blob(filename)
                blob.upload_from_string(audio_bytes, content_type="audio/mpeg")

                # Try to make public (only works if bucket allows ACLs)
                try:
                    blob.make_public()
                    public_url = blob.public_url
                    print(f"GCS Upload OK: {public_url}")
                    return {
                        "status": "success",
                        "audio_url": public_url,
                        "type": "url"
                    }
                except Exception:
                    # Bucket has Uniform Bucket-Level Access - use signed URL or fallback
                    print("Warning: make_public failed (Uniform Bucket-Level Access). Falling back to base64.")
            except Exception as ge:
                print(f"GCS Upload Error: {str(ge)} — falling back to base64")

        # 3. Fallback: Return base64 audio (works without GCS public access)
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        return {
            "status": "success",
            "audio_data": audio_base64,
            "type": "base64"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"GCS/TTS Critical Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GCP Error: {str(e)}")


class ImageRequest(BaseModel):
    prompt: Optional[str] = None
    topic: Optional[str] = None

@router.post("/generate-image")
async def generate_image(req: ImageRequest):
    """
    Generate an educational illustration via Imagen 3.
    """
    if not req.prompt and not req.topic:
        raise HTTPException(status_code=400, detail="Must provide prompt or topic")
        
    try:
        from app.agents.visual_agent import visual_agent
        
        actual_prompt = req.prompt
        if not actual_prompt and req.topic:
            print(f"DEBUG: Generating prompt for topic: {req.topic}")
            actual_prompt = await visual_agent.generate_diagram_prompt(req.topic)
            print(f"DEBUG: Generated prompt: {actual_prompt}")
            
        print(f"DEBUG: Requesting illustration from VisualAgent...")
        image_bytes = await visual_agent.generate_illustration(actual_prompt)
        
        if not image_bytes:
            print("ERROR: VisualAgent returned NO image bytes")
            raise HTTPException(status_code=500, detail="Image generation failed: VisualAgent returned no data")
            
        print(f"DEBUG: Image generated successfully ({len(image_bytes)} bytes)")
        
        # Upload to GCS
    bucket_name = settings.GCP_STORAGE_BUCKET
    creds_path = settings.GOOGLE_APPLICATION_CREDENTIALS
    
    if creds_path:
        creds_path = os.path.normpath(creds_path.strip('"').strip("'"))
    if bucket_name:
        bucket_name = bucket_name.strip('"').strip("'")
        
    try:
        if bucket_name:
            if settings.GCP_SERVICE_ACCOUNT_JSON:
                cred_dict = json.loads(settings.GCP_SERVICE_ACCOUNT_JSON)
                storage_client = storage.Client.from_service_account_info(cred_dict)
            elif creds_path and os.path.exists(creds_path):
                storage_client = storage.Client.from_service_account_json(creds_path)
            else:
                storage_client = storage.Client()

            bucket = storage_client.bucket(bucket_name)
            filename = f"images/{uuid.uuid4()}.jpg"
            blob = bucket.blob(filename)
            blob.upload_from_string(image_bytes, content_type="image/jpeg")

            # Try to make public (only works if bucket allows ACLs)
            try:
                blob.make_public()
                public_url = blob.public_url
                print(f"GCS Image Upload OK: {public_url}")
                return {
                    "status": "success",
                    "image_url": public_url,
                    "type": "url"
                }
            except Exception:
                print("Warning: image make_public failed. Falling back to base64.")
                pass
                
        # Fallback: Return base64 image
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        return {
            "status": "success",
            "image_data": image_base64,
            "type": "base64"
        }
    except Exception as e:
        print(f"GCS Image Upload Error: {str(e)} - falling back to base64")
        # Fallback to base64
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        return {
            "status": "success",
            "image_data": image_base64,
            "type": "base64"
        }
