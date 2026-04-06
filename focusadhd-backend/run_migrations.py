import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def run_migrations():
    print("Running initial schema migration...")
    
    # Read the SQL file
    sql_path = os.path.join(os.path.dirname(__file__), "supabase", "migrations", "001_initial_schema.sql")
    with open(sql_path, "r") as f:
        sql = f.read()

    # Create special sync or async engine just for raw queries
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
            # We can't use a single text() block for multiple statements with some drivers,
            # but Postgres handles multiple statements in a single string well.
            await conn.execute(text(sql))
            print("Migration executed successfully.")
    except Exception as e:
        print(f"Error executing migration: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migrations())
