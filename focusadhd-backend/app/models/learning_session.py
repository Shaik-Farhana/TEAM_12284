from sqlalchemy import Column, String, DateTime, text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base
import uuid

class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    topic = Column(String(255), nullable=False)
    current_state = Column(String(50), default="Focused", nullable=False)
    reread_count = Column(Integer, default=0, nullable=False)
    adaptation_reason = Column(String, nullable=True)
    content_version = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
