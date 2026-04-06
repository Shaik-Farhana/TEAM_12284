from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base
import uuid

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    preferred_style = Column(String(50), default="Balanced", nullable=False) # Concise | Balanced | Detailed
    audio_enabled = Column(Boolean, default=False, nullable=False)
    font_size = Column(String(20), default="Medium", nullable=False) # Small | Medium | Large
    high_contrast = Column(Boolean, default=False, nullable=False)
    reduce_motion = Column(Boolean, default=False, nullable=False)
    vision_enabled = Column(Boolean, default=False, nullable=False)
