from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.auth.router import router as auth_router
from app.routers.cheatsheets import router as cheatsheets_router
from app.routers.groups import router as groups_router
from app.routers.images import router as images_router
from app.routers.export import router as export_router

app = FastAPI(title="CheatSheetMaker API", version="2.0.0")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(cheatsheets_router)
app.include_router(groups_router)
app.include_router(images_router)
app.include_router(export_router)


@app.get("/health")
def health():
    return {"status": "ok"}
