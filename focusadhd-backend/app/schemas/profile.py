from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional

class ProfileBase(BaseModel):
    display_name: Optional[str] = None
    role: str = "student"
    onboarding_completed: bool = False

class ProfileCreate(ProfileBase):
    id: UUID

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    onboarding_completed: Optional[bool] = None

class ProfileResponse(ProfileBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
