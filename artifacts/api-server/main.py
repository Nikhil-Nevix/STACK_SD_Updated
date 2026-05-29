import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import engine, Base
from app.routers import auth, tickets, dashboard, reports, roi, logs, admin, sops, chat
from app.middleware.logging import RequestLoggingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="STACK Service Desk AI",
    description="Enterprise IT service desk automation platform by Jade Global Software Pvt Ltd",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

# Mount all routers under /api prefix
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["tickets"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(roi.router, prefix="/api/v1/roi", tags=["roi"])
app.include_router(logs.router, prefix="/api/v1/logs", tags=["logs"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(sops.router, prefix="/api/v1/sops", tags=["sops"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])


@app.get("/api/healthz")
async def health():
    return {"status": "ok", "service": "STACK API", "version": "1.0.0"}


@app.get("/api/v1/health")
async def health_v1():
    return {"status": "ok"}


@app.exception_handler(404)
async def not_found(request, exc):
    return JSONResponse(status_code=404, content={"error": "Not found"})


@app.exception_handler(500)
async def server_error(request, exc):
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
