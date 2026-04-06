from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.profile import Profile
from app.models.user_settings import UserSettings

router = APIRouter()

class ProfileSettingsUpdate(BaseModel):
    display_name: str | None = None
    preferred_style: str | None = None
    audio_enabled: bool | None = None
    vision_enabled: bool | None = None

@router.get("/me")
async def get_my_settings(db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    prof_result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = prof_result.scalars().first()
    
    # Auto-create profile if somehow missing
    if not profile:
        profile = Profile(id=user.id, display_name="Student")
        db.add(profile)
        await db.flush()

    sett_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = sett_result.scalars().first()
    
    if not settings:
        settings = UserSettings(user_id=profile.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        
    return {
        "display_name": profile.display_name,
        "email": getattr(user, "email", ""),
        "preferred_style": settings.preferred_style,
        "audio_enabled": settings.audio_enabled,
        "vision_enabled": getattr(settings, "vision_enabled", False)
    }

@router.put("/me")
async def update_my_settings(req: ProfileSettingsUpdate, db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    prof_result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = prof_result.scalars().first()
    if profile and req.display_name is not None:
        profile.display_name = req.display_name
        
    sett_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = sett_result.scalars().first()
    if settings:
        if req.preferred_style is not None:
            settings.preferred_style = req.preferred_style
        if req.audio_enabled is not None:
            settings.audio_enabled = req.audio_enabled
        if req.vision_enabled is not None:
            settings.vision_enabled = req.vision_enabled
            
    await db.commit()
    return {"status": "success"}

from app.models.learning_session import LearningSession
from app.models.session_analytics import SessionAnalytics
from app.models.profile import Profile
from sqlalchemy import func, desc

@router.get("/me/dashboard")
async def get_dashboard_kpis(db: AsyncSession = Depends(get_db), user: any = Depends(get_current_user)):
    # 0. Get Name from Metadata if available, else Profile
    display_name = None
    if hasattr(user, "user_metadata") and user.user_metadata:
        # Prioritize full_name/name over display_name which might be the email
        display_name = user.user_metadata.get("full_name") or user.user_metadata.get("name") or user.user_metadata.get("display_name")
        
    if not display_name:
        prof_stmt = select(Profile.display_name).where(Profile.id == user.id)
        display_name = await db.scalar(prof_stmt) or "Student"

    # 1. Total Sessions (count all for user)
    import uuid
    u_id = uuid.UUID(user.id) if isinstance(user.id, str) else user.id

    count_stmt = select(func.count()).select_from(LearningSession).where(
        LearningSession.user_id == u_id
    )
    total_sessions = await db.scalar(count_stmt) or 0
    
    # 2. Focus Time and Engagement via SessionAnalytics
    analytics_stmt = select(
        func.sum(SessionAnalytics.duration_seconds),
        func.sum(SessionAnalytics.total_distraction_seconds),
        func.sum(SessionAnalytics.focus_seconds)
    ).join(LearningSession, LearningSession.id == SessionAnalytics.session_id).where(
        LearningSession.user_id == u_id
    )
    
    res = await db.execute(analytics_stmt)
    agg = res.fetchone()
    sum_dur = agg[0] or 0
    sum_distr = agg[1] or 0
    sum_focus = agg[2] or 0
    
    # Focus Time is now directly pulled from focus_seconds column
    total_focus_seconds = sum_focus
    
    avg_engagement = 0
    if sum_dur > 0:
        # Engagement relative to total duration
        avg_engagement = int((sum_focus / sum_dur) * 100)
    
    # 3. Recent Sessions List (max 10) - Show ALL for visibility
    recent_stmt = select(LearningSession, SessionAnalytics.dominant_state).join(
        SessionAnalytics, LearningSession.id == SessionAnalytics.session_id, isouter=True
    ).where(
        LearningSession.user_id == u_id
    ).order_by(desc(LearningSession.created_at)).limit(10)
    
    recent_res = await db.execute(recent_stmt)
    recent_rows = recent_res.all()
    
    recent_list = []
    for row in recent_rows:
        sess, dom_state = row 
        recent_list.append({
            "id": str(sess.id),
            "topic": sess.topic,
            "created_at": sess.created_at.isoformat(),
            "dominant_state": dom_state or sess.current_state # Fallback to current state if no analytics
        })
        
    return {
        "display_name": display_name,
        "kpis": {
            "total_sessions": total_sessions,
            "focus_seconds": int(total_focus_seconds),
            "avg_engagement": avg_engagement
        },
        "recent_sessions": recent_list
    }

