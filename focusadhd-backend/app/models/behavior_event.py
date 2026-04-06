from sqlalchemy import Column, String, DateTime, text, Integer, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base
import uuid

class BehaviorEvent(Base):
    __tablename__ = "behavior_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False) # e.g., 'scroll', 'pause', 'reread'
    reading_speed_wpm = Column(Float, nullable=True)
    pause_duration = Column(Float, nullable=True) # in seconds
    vision_metadata = Column(String(255), nullable=True) # e.g., 'Looking Away'
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"), nullable=False)
