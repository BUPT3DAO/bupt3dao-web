from sqlalchemy import create_engine, inspect

from app.db import Base
from app.migrations import ensure_schema
from app.models import Article, Notification, Post


def test_startup_migration_adds_compound_indexes_to_existing_schema() -> None:
    engine = create_engine("sqlite://")
    try:
        Base.metadata.create_all(engine)
        expected = {
            "posts": ("ix_posts_topic_created_at_id",),
            "articles": ("ix_articles_pinned_order_created_id",),
            "notifications": (
                "ix_notifications_user_created_id",
                "ix_notifications_user_is_read",
            ),
        }
        models = {"posts": Post, "articles": Article, "notifications": Notification}
        for table_name, index_names in expected.items():
            for index_name in index_names:
                index = next(
                    index
                    for index in models[table_name].__table__.indexes
                    if index.name == index_name
                )
                index.drop(engine)

        ensure_schema(engine)

        for table_name, index_names in expected.items():
            indexes = {item["name"] for item in inspect(engine).get_indexes(table_name)}
            assert set(index_names) <= indexes
    finally:
        engine.dispose()
