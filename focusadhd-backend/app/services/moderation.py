from fastapi import HTTPException
from google import genai
from google.genai import types

class ModerationService:
    @staticmethod
    def get_safety_settings():
        """
        Returns strict safety settings for Gemini to ensure educational content remains safe.
        """
        return [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            ),
        ]

    @staticmethod
    def validate_topic(topic: str):
        """
        Simple keyword-based blocklist to ensure topics remain educational.
        """
        blocked_keywords = ["폭력", "violence", "porn", "hack", "illegal"]
        topic_lower = topic.lower()
        for word in blocked_keywords:
            if word in topic_lower:
                raise HTTPException(status_code=400, detail=f"Topic involves restricted keywords: {word}")
        
        # In a real scenario, we might also run the topic string through a lightweight NLP classifier.

moderation_service = ModerationService()
