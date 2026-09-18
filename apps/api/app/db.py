from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def _engine_options() -> dict[str, object]:
    if settings.database_url.startswith("sqlite"):
        # SQLite 文件所在目录需要先存在
        path = settings.database_url.split("///", 1)[-1]
        if path and path != ":memory:":
            from pathlib import Path

            Path(path).parent.mkdir(parents=True, exist_ok=True)
        return {"connect_args": {"check_same_thread": False}}
    return {}


engine = create_engine(settings.database_url, pool_pre_ping=True, **_engine_options())

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
