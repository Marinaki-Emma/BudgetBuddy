"""
Database connection setup. Reads connection details from environment
variables (see .env.example) and exposes a SQLAlchemy engine plus a
get_db() dependency for use in FastAPI route handlers.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "expense_tracker")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# pool_pre_ping checks connections are alive before using them — without
# this, a connection that's gone stale (e.g. MySQL closed it after being
# idle, which happens often on a personal server that isn't always busy)
# causes a confusing error on the next request instead of being silently
# refreshed.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it,
    even if the request raises an exception."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
