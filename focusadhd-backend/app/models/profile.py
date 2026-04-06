from sqlalchemy import Column, String, DateTime, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.db.database import Base
import uuid

class Profile(Base):
    __tablename__ = "profiles"

    # ID matches auth.users.id from Supabase
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, server_default="student")
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"), nullable=False)
