from google import genai
from google.genai import types
from app.core.config import settings
from app.core.gcp_clients import get_genai_client

# Initialize Gemini Client via centralized module (using Vertex AI in production)
client = get_genai_client(use_vertex=True)

class AudioAgent:
    async def generate_speech(self, text: str) -> bytes:
        """
        Converts text to speech using Gemini's native multimodal output.
        Supported in Gemini 2.0 / 3.0.
        """
        # Note: In a real production app, we would use specialized TTS for better control,
        # but Gemini native multimodal output is a powerful alternative for Phase 2.
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Please narrate this text exactly: {text}",
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"]
            )
        )
        # Handle the audio part of the response
        # Gemini multimodal out returns audio as part of the candidate.content.parts
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data # This is already bytes from the SDK
        
        return b""

audio_agent = AudioAgent()
