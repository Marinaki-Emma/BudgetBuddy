"""
Sync endpoints — push/pull with last-write-wins conflict resolution.

Protocol:
  POST /sync/push  — device sends its dirty rows, server upserts them
  POST /sync/pull  — device sends its last_synced_at, server returns newer rows
  GET  /sync/ping  — health check (auth + DB)

Conflict resolution: last-write-wins on updated_at (ISO string comparison).
The device always sends its full dirty rows; the server only overwrites a
row if the incoming updated_at is newer than what it already has.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.auth import verify_token
from app.models import (
    Account, Category, Transaction, Budget,
    RecurringTemplate, DeviceSyncState,
)

router = APIRouter(prefix="/sync", tags=["sync"])

# ─── Helpers ──────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def model_to_dict(obj: Any) -> dict[str, Any]:
    """Convert a SQLAlchemy model instance to a plain dict."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class PushPayload(BaseModel):
    device_id: str
    accounts:            list[dict[str, Any]] = []
    categories:          list[dict[str, Any]] = []
    transactions:        list[dict[str, Any]] = []
    budgets:             list[dict[str, Any]] = []
    recurring_templates: list[dict[str, Any]] = []

class PullRequest(BaseModel):
    device_id: str
    since: str | None = None   # ISO timestamp — only return rows updated after this

class PullResponse(BaseModel):
    server_time: str
    accounts:            list[dict[str, Any]]
    categories:          list[dict[str, Any]]
    transactions:        list[dict[str, Any]]
    budgets:             list[dict[str, Any]]
    recurring_templates: list[dict[str, Any]]

# ─── Upsert helper ────────────────────────────────────────────────────────────

def upsert_rows(db: Session, model: type[Any], incoming: list[dict[str, Any]], server_time: str) -> None:
    """
    For each incoming row, upsert into the server DB using last-write-wins:
    - If the row doesn't exist → insert it.
    - If it exists and incoming updated_at >= existing updated_at → overwrite.
    - If it exists and incoming updated_at < existing → skip (server is newer).
    Always marks last_synced_at = server_time and dirty = 0 on accepted rows.
    """
    for row in incoming:
        row_id = row.get("id")
        if not row_id:
            continue

        existing = db.get(model, row_id)
        incoming_updated = row.get("updated_at", "")

        if existing is None:
            # New row — insert
            row["last_synced_at"] = server_time
            row["dirty"] = 0
            obj = model(**{k: v for k, v in row.items()
                           if hasattr(model, k)})
            db.add(obj)
        elif incoming_updated >= (existing.updated_at or ""):
            # Incoming is same age or newer — overwrite
            for key, val in row.items():
                if hasattr(existing, key):
                    setattr(existing, key, val)
            existing.last_synced_at = server_time
            existing.dirty = 0
        # else: server row is newer, skip


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/ping")
def ping(db: Session = Depends(get_db), _: bool = Depends(verify_token)):
    """Auth + DB health check."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "server_time": now_iso()}


@router.post("/push")
def push(
    payload: PushPayload,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_token),
):
    """
    Accept dirty rows from a device and upsert them into the server DB.
    Returns the server timestamp to use as the device's new last_synced_at.
    """
    server_time = now_iso()

    upsert_rows(db, Account,           payload.accounts,            server_time)
    upsert_rows(db, Category,          payload.categories,          server_time)
    upsert_rows(db, RecurringTemplate, payload.recurring_templates, server_time)
    upsert_rows(db, Budget,            payload.budgets,             server_time)
    upsert_rows(db, Transaction,       payload.transactions,        server_time)

    # Update device sync state
    state = db.get(DeviceSyncState, payload.device_id)
    if state:
        state.last_synced_at = server_time
    else:
        db.add(DeviceSyncState(device_id=payload.device_id, last_synced_at=server_time))

    db.commit()

    return {"status": "ok", "synced_at": server_time}


@router.post("/pull")
def pull(
    req: PullRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_token),
) -> PullResponse:
    """
    Return all rows updated since the device's last sync.
    If since is None, return everything (first sync).
    """
    server_time = now_iso()
    since = req.since or "1970-01-01T00:00:00"

    def fetch(model: type[Any]) -> list[dict[str, Any]]:
        rows = db.query(model).filter(model.updated_at > since).all()
        return [model_to_dict(r) for r in rows]

    result = PullResponse(
        server_time=server_time,
        accounts=fetch(Account),
        categories=fetch(Category),
        transactions=fetch(Transaction),
        budgets=fetch(Budget),
        recurring_templates=fetch(RecurringTemplate),
    )

    # Update device sync state
    state = db.get(DeviceSyncState, req.device_id)
    if state:
        state.last_synced_at = server_time
    else:
        db.add(DeviceSyncState(device_id=req.device_id, last_synced_at=server_time))

    db.commit()

    return result