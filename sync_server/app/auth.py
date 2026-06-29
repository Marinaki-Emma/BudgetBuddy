"""
Minimal auth: every sync request must include a header
`Authorization: Bearer <SYNC_AUTH_TOKEN>` matching the token in .env.
This is intentionally simple — a personal single-user server doesn't
need full OAuth, just enough to stop random internet traffic hitting
your tunnel from doing anything.
"""
import os
from fastapi import Header, HTTPException, status
from dotenv import load_dotenv

load_dotenv()

EXPECTED_TOKEN = os.getenv("SYNC_AUTH_TOKEN")


def verify_token(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not EXPECTED_TOKEN or token != EXPECTED_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid sync token",
        )
    return True
