from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

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

class CompleteSessionRequest(BaseModel):
    elapsed_seconds: Optional[int] = None  # Actual time THIS sitting lasted

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
async def complete_session(session_id: str, req: CompleteSessionRequest = None, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Mark a session as completed. Accumulates duration into SessionAnalytics.
    Accepts elapsed_seconds from the frontend to avoid inflating resumed sessions.
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
        
        # Use frontend-provided elapsed_seconds if available (most accurate for resumed sessions).
        # Fall back to (now - created_at) capped at 8 hours to prevent day-old session inflation.
        if req and req.elapsed_seconds is not None and req.elapsed_seconds >= 0:
            this_sitting_seconds = req.elapsed_seconds
        else:
            start_time = session.created_at
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            raw_duration = int((now - start_time).total_seconds())
            this_sitting_seconds = max(0, min(raw_duration, 28800))  # Cap at 8 hours
        
        # Sum up distraction events logged THIS session (from all time, not just this sitting)
        distraction_seconds = int(sum(e.pause_duration or 0 for e in events))
        # Cap so distraction can't exceed total time this sitting
        distraction_seconds = min(distraction_seconds, this_sitting_seconds)
        
        focus_seconds = max(0, this_sitting_seconds - distraction_seconds)
        
        # Determine overall state for dashboard display
        analysis = behavior_analyzer.analyze_events(events)
        dominant_state = analysis.get("state", "Focused")

        # 2. Persist to SessionAnalytics - ACCUMULATE if already exists for this session
        from sqlalchemy.dialects.postgresql import insert
        existing_res = await db.execute(
            select(SessionAnalytics).where(SessionAnalytics.session_id == session.id)
        )
        existing = existing_res.scalars().first()

        if existing:
            # Add this sitting's data on top of previous sittings
            existing.duration_seconds = existing.duration_seconds + this_sitting_seconds
            existing.total_distraction_seconds = min(
                existing.total_distraction_seconds + distraction_seconds,
                existing.duration_seconds
            )
            existing.focus_seconds = max(0, existing.duration_seconds - existing.total_distraction_seconds)
            existing.dominant_state = dominant_state
        else:
            stmt = insert(SessionAnalytics).values(
                session_id=session.id,
                duration_seconds=this_sitting_seconds,
                total_distraction_seconds=distraction_seconds,
                focus_seconds=focus_seconds,
                dominant_state=dominant_state
            ).on_conflict_do_update(
                index_elements=['session_id'],
                set_={
                    "duration_seconds": this_sitting_seconds,
                    "total_distraction_seconds": distraction_seconds,
                    "focus_seconds": focus_seconds,
                    "dominant_state": dominant_state
                }
            )
            await db.execute(stmt)

        await db.commit()
    return {"status": "success"}
