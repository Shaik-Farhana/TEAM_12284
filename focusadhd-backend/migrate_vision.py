import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def run_migration():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    db_url = db_url.split("?")[0]
    db_url = db_url.replace(":6543", ":5432")

    engine = create_async_engine(db_url, isolation_level="AUTOCOMMIT")

    try:
        async with engine.connect() as conn:
            await conn.execute(text("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS vision_enabled BOOLEAN DEFAULT FALSE NOT NULL;"))
            print("Migration executed successfully.")
    except Exception as e:
        print(f"Error executing migration: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
