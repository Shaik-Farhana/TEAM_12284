import asyncio
import os
import sys

# Ensure our imports resolve correctly when run from backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase_client import supabase
from app.core.config import settings

async def seed_database():
    print(f"Starting seed process for environment: {settings.ENVIRONMENT}")
    if settings.ENVIRONMENT != "development":
        print("ERROR: Seed script should only be run in development.")
        return

    # Delete existing test users if they exist
    print("Cleaning up old test data...")
    test_emails = ["teststudent1@example.com", "teststudent2@example.com"]
    
    # We query auth.users by getting profiles and cleaning up if possible, but
    # Supabase admin API doesn't easily let us query users by email directly without pagination.
    # Instead, we will wrap user creation in try-except in case they exist.

    test_users = []
    
    for idx, email in enumerate(test_emails):
        print(f"Creating test user: {email}...")
        try:
            # We use the admin api to create users which skips email confirmation
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": "Password123!",
                "user_metadata": {
                    "display_name": f"Test Student {idx+1}"
                },
                "email_confirm": True
            })
            if res.user:
                test_users.append(res.user)
                print(f"Created user: {res.user.id}")
        except Exception as e:
            print(f"Failed or user exists for {email}: {e}")

    if not test_users:
        print("No test users created or found. Ensure Service Role Key has sufficient privileges.")
        return

    print("Generating Learning Sessions and Behaviors...")

    for user in test_users:
        # Insert 3 sessions for each user
        sessions = [
            {
                "user_id": user.id,
                "topic": "Photosynthesis Basics",
                "current_state": "Focused",
                "reread_count": 0,
                "content_version": 1
            },
            {
                "user_id": user.id,
                "topic": "Intro to Python Loops",
                "current_state": "Distracted",
                "reread_count": 2,
                "adaptation_reason": "High reread rate, simplified text.",
                "content_version": 2
            },
            {
                "user_id": user.id,
                "topic": "World War II Timeline",
                "current_state": "Fatigued",
                "reread_count": 0,
                "adaptation_reason": "Pause duration exceeded 5s, added interactive quiz.",
                "content_version": 3
            }
        ]

        session_res = supabase.table("learning_sessions").insert(sessions).execute()
        
        if not session_res.data:
            print(f"Failed to create sessions for {user.id}")
            continue

        print(f"Created {len(session_res.data)} sessions for user {user.id}")

        # Insert behavior events for the first session
        first_session_id = session_res.data[0]['id']
        behaviors = [
            {
                "session_id": first_session_id,
                "event_type": "scroll",
                "reading_speed_wpm": 200,
            },
            {
                "session_id": first_session_id,
                "event_type": "pause",
                "pause_duration": 4.5,
            },
            {
                "session_id": first_session_id,
                "event_type": "highlight",
            }
        ]
        
        beh_res = supabase.table("behavior_events").insert(behaviors).execute()
        print(f"Inserted {len(beh_res.data) if beh_res.data else 0} behavior events for session {first_session_id}")

    print("\n--- Seeding Complete ---")
    print("You can now login with:")
    for email in test_emails:
        print(f"Email: {email}")
        print("Password: Password123!")
        print("--------------------")

if __name__ == "__main__":
    asyncio.run(seed_database())
