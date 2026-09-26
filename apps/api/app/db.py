from collections.abc import Generator

from sqlalchemy import create_engine, event
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
        # 避免蓝绿容器或短时并发写入时，SQLite 的默认 5 秒忙等过早失败。
        return {"connect_args": {"check_same_thread": False, "timeout": 30}}
    return {}


engine = create_engine(settings.database_url, pool_pre_ping=True, **_engine_options())

if settings.database_url.startswith("sqlite") and settings.database_url != "sqlite://":

    @event.listens_for(engine, "connect")
    def _configure_sqlite_connection(connection, _record) -> None:
        """让蓝绿切换期间的 SQLite 读请求不阻塞写事务。"""
        cursor = connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
        finally:
            cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
