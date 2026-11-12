
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.routers import ai, comments, notifications, projects, sprints, tasks, workspaces

app = FastAPI(
    title="OpenShip API",
    description="API for managing projects, tasks, sprints, and team collaboration.",
    version="1.0.1"
)

_origins = [
    o.strip()
    for o in get_settings().frontend_origin.split(",")
    if o.strip()
]

# Support localhost and 127.0.0.1 during local development.
_dev_regex = (
    r"http://(localhost|127\.0\.0\.1)(:\d+)?"
    if any("localhost" in o for o in _origins)
    else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=_dev_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(workspaces.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(comments.router)
app.include_router(sprints.router)
app.include_router(notifications.router)
app.include_router(ai.router)


@app.get("/")
def root():
    """Return basic information about the OpenShip API."""
    return {
        "message": "Welcome to OpenShip API",
        "version": "1.0.1",
        "documentation": "/docs",
        "health_check": "/health"
    }


@app.get("/health")
def health():
    """Check whether the API is running."""
    return {
        "status": "ok",
        "service": "OpenShip API"
    }

