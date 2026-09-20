from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import engine
from app.migrations import ensure_schema
from app.routers import admin, articles, auth, members, notifications, posts, site, users

# 骨架阶段用 create_all + 轻量补列建表；后续数据模型稳定后可换成 Alembic 迁移
ensure_schema(engine)
settings.upload_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.app_name, version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 头像等静态文件；目录在前面的步骤里已确保存在
app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(posts.router)
api.include_router(notifications.router)
api.include_router(users.router)
api.include_router(members.router)
api.include_router(articles.router)
api.include_router(site.router)
api.include_router(admin.router)


@api.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


app.include_router(api)
