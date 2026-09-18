"""骨架阶段还没有引入 Alembic。

新建的表交给 create_all；给已有表补新列用幂等的 ALTER TABLE，数据保持不动。
"""

from sqlalchemy import Engine, func, inspect, select, text
from sqlalchemy.orm import Session

from app.db import Base
from app.models import Post, ProfileDetail

# 表名 -> 需要补齐的列（列名, DDL 片段）
_LIGHT_COLUMNS: dict[str, tuple[tuple[str, str], ...]] = {
    "users": (("banner_url", "VARCHAR(255)"),),
    "posts": (
        ("title", "VARCHAR(140) NOT NULL DEFAULT ''"),
        ("topic", "VARCHAR(20) NOT NULL DEFAULT ''"),
    ),
    "profile_details": (("university", "VARCHAR(80) NOT NULL DEFAULT ''"),),
}


def _add_missing_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table, columns in _LIGHT_COLUMNS.items():
            if table not in tables:
                continue
            present = {column["name"] for column in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in present:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def _backfill(db: Session) -> None:
    """早期版本的届别是两位年份，老帖子没有标题，这里做一次性的补齐。"""
    legacy_cohorts = db.scalars(
        select(ProfileDetail).where(func.length(ProfileDetail.cohort) == 2)
    ).all()
    for detail in legacy_cohorts:
        detail.cohort = f"20{detail.cohort}"

    untitled = db.scalars(select(Post).where(Post.title == "")).all()
    for post in untitled:
        post.title = " ".join(post.content.split())[:60] or "无标题帖子"

    if legacy_cohorts or untitled:
        db.commit()


def ensure_schema(engine: Engine) -> None:
    """幂等：可以安全地在每次启动时调用。"""
    Base.metadata.create_all(bind=engine)
    _add_missing_columns(engine)
    with Session(engine) as db:
        _backfill(db)
