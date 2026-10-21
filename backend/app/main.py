from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.routers import projects, tasks, workspaces

app = FastAPI(title="OpenShip API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)
app.include_router(workspaces.router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
