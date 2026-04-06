from sqlalchemy import Column, String, DateTime, text, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base
import uuid

class SessionContent(Base):
    __tablename__ = "session_content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # The actual content
    content_text = Column(Text, nullable=False)
    audio_url = Column(String(512), nullable=True)
    visual_url = Column(String(512), nullable=True)
    
    # Metadata for ordering and context
    state_at_generation = Column(String(50), nullable=True) # Focused, Overloaded, Drifting
    adaptation_reason = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"), nullable=False)
