from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import sync

app = FastAPI(title="Expense Tracker Sync Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync.router)

@app.get("/")
def root():
    return {"service": "expense-tracker-sync-server", "status": "running"}