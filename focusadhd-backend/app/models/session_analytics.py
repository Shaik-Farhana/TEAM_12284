from sqlalchemy import Column, String, DateTime, text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base
import uuid

class SessionAnalytics(Base):
    __tablename__ = "session_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False, unique=True)
    duration_seconds = Column(Integer, default=0, nullable=False)
    total_distraction_seconds = Column(Integer, default=0, nullable=False)
    focus_seconds = Column(Integer, default=0, nullable=False)
    dominant_state = Column(String(50), default="Focused", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"), nullable=False)
