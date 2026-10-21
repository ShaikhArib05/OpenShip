from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.routers import ai, comments, notifications, projects, sprints, tasks, workspaces

app = FastAPI(title="OpenShip API")
_origins = [o.strip() for o in get_settings().frontend_origin.split(",") if o.strip()]
# In local development, localhost and 127.0.0.1 are both valid ways to open the app.
_dev_regex = r"http://(localhost|127\.0\.0\.1)(:\d+)?" if any("localhost" in o for o in _origins) else None
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


@app.get("/health")
def health():
    return {"status": "ok"}
