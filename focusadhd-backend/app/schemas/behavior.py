from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class BehaviorEventCreate(BaseModel):
    session_id: str
    event_type: str = Field(..., description="'scroll', 'pause', 'highlight', 'reread'")
    reading_speed_wpm: Optional[int] = None
    pause_duration: Optional[float] = None
    metadata: Optional[dict] = None

class StateAnalysisResponse(BaseModel):
    state: str = Field(..., description="'Focused', 'Overloaded', 'Drifting'")
    reason: str
    wpm_avg: Optional[int] = None
    reread_count: int = 0
