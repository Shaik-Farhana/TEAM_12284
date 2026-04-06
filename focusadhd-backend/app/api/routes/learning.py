import json
import uuid
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sse_starlette.sse import EventSourceResponse

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.behavior_event import BehaviorEvent
from app.models.learning_session import LearningSession
from app.models.user_settings import UserSettings
from app.models.session_content import SessionContent
from app.schemas.behavior import BehaviorEventCreate
from app.services.behavior_analyzer import behavior_analyzer
from app.services.moderation import moderation_service
from app.agents.text_agent import text_agent
from app.agents.audio_agent import audio_agent
from app.agents.visual_agent import visual_agent
from app.core.supabase_client import supabase
from app.core.config import settings

router = APIRouter()

@router.get("/{session_id}/history")
async def get_session_history(session_id: str, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Retrieve the historical content generated for this session.
    """
    result = await db.execute(
        select(SessionContent)
        .where(SessionContent.session_id == session_id)
        .order_by(SessionContent.created_at.asc())
    )
    history = result.scalars().all()
    return history

@router.get("/{session_id}/analytics")
async def get_session_analytics(session_id: str, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Generate analytics for the session: focus score, drift count, and timeline.
    """
    # Fetch all activity (Events + Content generations) to find the "latest block" of activity
    drift_result = await db.execute(
        select(BehaviorEvent)
        .where(BehaviorEvent.session_id == session_id)
        .where(BehaviorEvent.event_type == 'VisionDistractionEnd')
        .order_by(BehaviorEvent.created_at.asc())
    )
    all_drifts = drift_result.scalars().all()

    content_result = await db.execute(
        select(SessionContent.created_at)
        .where(SessionContent.session_id == session_id)
        .order_by(SessionContent.created_at.asc())
    )
    all_content_times = content_result.scalars().all()

    sess_result = await db.execute(select(LearningSession.created_at).where(LearningSession.id == session_id))
    session_start = sess_result.scalar_one_or_none()

    # Combine all timestamps to find the most recent continuous block (separated by >30 mins)
    all_timestamps = [session_start] if session_start else []
    all_timestamps.extend([d.created_at for d in all_drifts])
    all_timestamps.extend(all_content_times)
    
    # Sort timestamps, drop None just in case
    all_timestamps = sorted([ts for ts in all_timestamps if ts])

    latest_block_start = all_timestamps[0] if all_timestamps else None
    for i in range(1, len(all_timestamps)):
        gap = (all_timestamps[i] - all_timestamps[i-1]).total_seconds()
        if gap > 1800:  # 30 minutes gap means a new session block started!
            latest_block_start = all_timestamps[i]

    # Filter drifts to only those in the latest block
    valid_drifts = [d for d in all_drifts if d.created_at >= latest_block_start] if latest_block_start else []

    # Calculate precise duration using UTC now
    from datetime import datetime, timezone
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None) # Depending on DB tz
    # Fallback to last event time if tz mismatch makes now_utc weird
    last_event_time = all_timestamps[-1] if all_timestamps else now_utc
    
    total_seconds = 0
    if latest_block_start:
        total_seconds = max((last_event_time - latest_block_start).total_seconds(), 0)
        # Pad duration slightly if it's too short (e.g., they just started and ended)
        if total_seconds < 30:
            total_seconds = 30 
    
    total_distraction_time = min(total_seconds, sum(d.pause_duration for d in valid_drifts if d.pause_duration))
    focus_score = 100
    if total_seconds > 0:
        focus_score = max(0, min(100, 100 * (1 - (total_distraction_time / (total_seconds + 0.001)))))
    
    # Estimate Duration in minutes for UI display
    duration_min = round(total_seconds / 60, 1)
    if duration_min < 1:
        duration_display = f"{int(total_seconds)}s"
    else:
        duration_display = f"{duration_min}m"

    return {
        "focus_score": round(focus_score, 1),
        "total_drifts": len(valid_drifts),
        "total_distraction_time": round(total_distraction_time, 1),
        "session_duration_seconds": round(total_seconds, 1),
        "duration_display": duration_display,
        "timeline": [
            {"timestamp": d.created_at, "duration": d.pause_duration} 
            for d in valid_drifts
        ]
    }

@router.post("/behavior")
async def log_behavior(events: list[BehaviorEventCreate], db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    """
    Log an array of behavior events (e.g., from a 10s batch in the frontend).
    """
    db_events = []
    for evt in events:
        db_events.append(BehaviorEvent(
            session_id=evt.session_id,
            event_type=evt.event_type,
            reading_speed_wpm=evt.reading_speed_wpm,
            pause_duration=evt.pause_duration,
        ))
    
    db.add_all(db_events)
    await db.commit()
    return {"status": "success", "inserted": len(db_events)}

@router.get("/stream")
async def stream_adaptive_content(
    request: Request,
    session_id: str,
    query: str = Query(..., description="The next bit of content the user is asking for, or 'next' to continue."),
    db: AsyncSession = Depends(get_db),
    user: any = Depends(get_current_user)
):
    """
    SSE stream of adaptive educational content.
    """
    # 1. Moderation Check on Input
    moderation_service.validate_topic(query)

    # 2. Fetch recent behavior events for the session to infer state
    evt_result = await db.execute(
        select(BehaviorEvent)
        .where(BehaviorEvent.session_id == session_id)
        .order_by(BehaviorEvent.created_at.desc())
        .limit(20) # Analyze last 20 events
    )
    recent_events = evt_result.scalars().all()
    
    analysis = behavior_analyzer.analyze_events(list(recent_events))
    inferred_state = analysis["state"]
    reason = analysis["reason"]

    # 3. Update the Session state
    sess_result = await db.execute(select(LearningSession).where(LearningSession.id == session_id))
    session_obj = sess_result.scalar_one_or_none()
    if session_obj:
        session_obj.current_state = inferred_state
        session_obj.adaptation_reason = reason
        await db.commit()

    # 4. Fetch User Preferences (preferred_style)
    pref_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    user_prefs = pref_result.scalar_one_or_none()
    preferred_style = user_prefs.preferred_style if user_prefs else "Balanced"

    # 4.5 Fetch Session History (Chain of Custody)
    hist_result = await db.execute(
        select(SessionContent.content_text)
        .where(SessionContent.session_id == session_id)
        .order_by(SessionContent.created_at.desc())
        .limit(3) # Last 3 chunks for context
    )
    history_texts = hist_result.scalars().all()
    history_texts.reverse() # Back to chronological for the AI

    # 5. Generator logic for EventSourceResponse
    async def event_generator():
        # First yield the State Update so UI can show a badge
        yield {
            "event": "state_update",
            "data": json.dumps({"state": inferred_state, "reason": reason})
        }
        
        # Then stream Gemini text chunks
        generated_text = ""
        async for text_chunk in text_agent.generate_adaptation_stream(
            topic=session_obj.topic if session_obj else "General Knowledge",
            state=inferred_state,
            reason=reason,
            preferred_style=preferred_style,
            history=history_texts
        ):
            if await request.is_disconnected():
                break
            generated_text += text_chunk
            yield {
                "event": "text_chunk",
                "data": json.dumps({"content": text_chunk})
            }
        
        # Finally, save this interaction to history
        if generated_text:
            try:
                new_content = SessionContent(
                    session_id=uuid.UUID(session_id),
                    content_text=generated_text,
                    audio_url=None,
                    visual_url=None,
                    state_at_generation=inferred_state,
                    adaptation_reason=reason
                )
                db.add(new_content)
                await db.commit()
            except Exception as e:
                print(f"Failed to save session content: {e}")

        yield {
            "event": "done",
            "data": json.dumps({"status": "completed"})
        }

    return EventSourceResponse(event_generator())
