import os
from typing import List
from google import genai
from google.genai import types
from app.services.moderation import moderation_service
from app.core.config import settings

# Wait to load CREDENTIALS from config (since main.py load_dotenv() populated it)
def _get_vertex_client():
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") is None and settings.GOOGLE_APPLICATION_CREDENTIALS:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
    
    return genai.Client(
        vertexai=True,
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_REGION,
    )

MODEL_NAME = "gemini-2.5-flash"

# System Instruction based on state
def _get_system_prompt(state: str, preferred_style: str) -> str:
    base = (
        "You are an adaptive educational AI tutor for FocusADHD. "
        "Your goal is to explain concepts clearly and concisely. "
        "IMPORTANT: Users with ADHD struggle with large walls of text. "
        "Keep your output 'bite-sized' (2-3 short paragraphs max). "
        "Use bolding for key terms and maintain a supportive tone. "
        "DO NOT explicitly mention ADHD or that you are adapting.\n\n"
        "STRUCTURE RULES:\n"
        "1. Every 2nd or 3rd response, insert an assessment question wrapped in [QUESTION] tags. "
        "Format: [QUESTION]{\"text\": \"Question text?\", \"options\": [\"A\", \"B\"], \"answer\": \"A\"}[/QUESTION]\n"
        "2. ALWAYS end your response with a summary block wrapped in [SUMMARY] tags. "
        "Format: [SUMMARY]- Key Point 1\n- Key Point 2[/SUMMARY]"
    )

    style_guidance = ""
    if preferred_style == "Concise":
        style_guidance = "Be extremely brief. Use bullet points and focus ONLY on core facts."
    elif preferred_style == "Balanced":
        style_guidance = "Provide a balance of high-level concepts and one solid example."
    elif preferred_style == "Detailed":
        style_guidance = "Provide a comprehensive explanation, but still break it into small, readable sections."

    state_adaptation = ""
    if state == "Focused":
        state_adaptation = "The user is engaged. Provide the next logical concept in a structured, easy-to-scan format. " + style_guidance
    elif state == "Overloaded":
        state_adaptation = (
            "The user is cognitively overloaded. SIMPLIFY drastically. "
            "Use only 1-2 sentences at a time. Use a simple real-world analogy."
        )
    elif state == "Drifting":
        state_adaptation = (
            "The user has lost focus. Regain their attention! "
            "Start with a highly engaging 'hook' or surprising fact. Keep it punchy."
        )

    return f"{base}\n\nSTATE ADAPTATION:\n{state_adaptation}"


class TextAgent:
    @staticmethod
    async def generate_adaptation_stream(topic: str, state: str, reason: str, preferred_style: str, history: List[str] = None):
        """
        Streams adapted content from Vertex AI Gemini based on the user's learning state.
        Uses gemini-2.5-flash natively on Vertex AI via Service Account.
        """
        client = _get_vertex_client()
        system_instruction = _get_system_prompt(state, preferred_style)

        history_context = ""
        if history:
            history_context = "\nPREVIOUSLY DISCUSSED (DO NOT REPEAT):\n" + "\n---\n".join(history)

        prompt = (
            f"Topic to explain: {topic}\n"
            f"{history_context}\n\n"
            f"Wait, I noticed the user is currently {state} because {reason}. "
            f"Please generate the NEXT logical chunk of educational content for this topic, picking up where you left off. "
            f"Avoid repeating any specific facts or sentences from the 'PREVIOUSLY DISCUSSED' block above."
        )

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            # GenAI API currently uses different safety blocks compared to vertexai, but keeping logic consistent
            temperature=0.7,
        )

        response_stream = await client.aio.models.generate_content_stream(
            model=MODEL_NAME,
            contents=prompt,
            config=config
        )

        async for chunk in response_stream:
            if chunk.text:
                yield chunk.text


text_agent = TextAgent()
