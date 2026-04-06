from pydantic import BaseModel
from typing import Optional

class AdaptationRequest(BaseModel):
    session_id: str
    topic: str
    current_knowledge: Optional[str] = None
    
class AdaptationResponse(BaseModel):
    state: str
    content_chunk: str
    reasoning: str
