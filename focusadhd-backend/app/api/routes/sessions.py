from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.profile import Profile
from app.models.learning_session import LearningSession
from app.models.session_content import SessionContent
from app.models.behavior_event import BehaviorEvent
from app.models.session_analytics import SessionAnalytics
from app.services.behavior_analyzer import behavior_analyzer
from pydantic import BaseModel

router = APIRouter()

class SessionCreate(BaseModel):
    topic: str

@router.post("/")
async def start_session(req: SessionCreate, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Start a new learning session for a given topic.
    """
    # 1. Ensure profile exists (Sync Auth -> Public if missing)
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = result.scalars().first()
    
    if not profile:
        # Get metadata from auth user if possible
        full_name = getattr(user, "email", "Student")
        if hasattr(user, "user_metadata") and user.user_metadata:
            full_name = user.user_metadata.get("full_name", full_name)
            
        new_profile = Profile(id=user.id, display_name=full_name)
        db.add(new_profile)
        await db.flush() # Ensure profile is flushed before referencing in session
        
    new_session = LearningSession(
        user_id=user.id,
        topic=req.topic,
        current_state="Focused",
        reread_count=0
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return {"status": "success", "session_id": new_session.id}

@router.get("/")
async def list_sessions(db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    List all previous sessions for the user.
    """
    result = await db.execute(
        select(LearningSession).where(LearningSession.user_id == user.id).order_by(LearningSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return {"sessions": sessions}
@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Retrieve details for a specific session.
    """
    result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id, LearningSession.user_id == user.id)
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Fetch content history
    content_result = await db.execute(
        select(SessionContent).where(SessionContent.session_id == session_id).order_by(SessionContent.created_at.asc())
    )
    history = content_result.scalars().all()
    
    return {
        "id": session.id,
        "topic": session.topic,
        "current_state": session.current_state,
        "history": [c.content_text for c in history]
    }

@router.post("/{session_id}/complete")
async def complete_session(session_id: str, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Mark a session as completed. Used when cleanly ending or unmounting.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id, LearningSession.user_id == user.id)
    )
    session = result.scalars().first()
    if session:
        session.current_state = "Completed"
        session.ended_at = now
        
        # 1. Calculate analytics from behavior events
        events_res = await db.execute(
            select(BehaviorEvent).where(BehaviorEvent.session_id == session_id).order_by(BehaviorEvent.created_at.asc())
        )
        events = list(events_res.scalars().all())
        
        # Total duration from creation to this completion call
        # Ensure we use UTC for session.created_at if it's not already
        start_time = session.created_at
        if start_time.tzinfo is None:
            from datetime import timezone
            start_time = start_time.replace(tzinfo=timezone.utc)

        duration = int((now - start_time).total_seconds())
        if duration < 0: duration = 0
        
        # Sum up specific periods of look-away/pause
        distraction_seconds = int(sum(e.pause_duration or 0 for e in events))
        
        # Focus time calculation
        focus_seconds = max(0, duration - distraction_seconds)
        
        # Determine overall state for dashboard display
        analysis = behavior_analyzer.analyze_events(events)
        dominant_state = analysis.get("state", "Focused")

        # 2. Persist to SessionAnalytics
        # Use merge because user might call complete twice (defensive)
        from sqlalchemy.dialects.postgresql import insert
        stmt = insert(SessionAnalytics).values(
            session_id=session.id,
            duration_seconds=duration,
            total_distraction_seconds=min(distraction_seconds, duration),
            focus_seconds=focus_seconds,
            dominant_state=dominant_state
        ).on_conflict_do_update(
            index_elements=['session_id'],
            set_={
                "duration_seconds": duration,
                "total_distraction_seconds": min(distraction_seconds, duration),
                "focus_seconds": focus_seconds,
                "dominant_state": dominant_state
            }
        )
        await db.execute(stmt)
        await db.commit()
    return {"status": "success"}
