from sqlalchemy import Index, create_engine, inspect

from app.db import Base
from app.migrations import ensure_schema
from app.models import Article, Comment, Notification, Post, User


def test_startup_migration_adds_compound_indexes_to_existing_schema() -> None:
    engine = create_engine("sqlite://")
    try:
        Base.metadata.create_all(engine)
        expected = {
            "users": ("ix_users_created_at_id",),
            "posts": ("ix_posts_topic_created_at_id", "ix_posts_author_created_at_id"),
            "comments": ("ix_comments_post_parent_created_id",),
            "articles": ("ix_articles_pinned_order_created_id",),
            "notifications": (
                "ix_notifications_user_created_id",
                "ix_notifications_user_is_read",
            ),
        }
        models = {
            "users": User,
            "posts": Post,
            "comments": Comment,
            "articles": Article,
            "notifications": Notification,
        }
        for table_name, index_names in expected.items():
            for index_name in index_names:
                index = next(
                    index
                    for index in models[table_name].__table__.indexes
                    if index.name == index_name
                )
                index.drop(engine)
        Index("ix_posts_topic", Post.topic).create(engine)
        Index("ix_posts_author_id", Post.author_id).create(engine)

        ensure_schema(engine)

        for table_name, index_names in expected.items():
            indexes = {item["name"] for item in inspect(engine).get_indexes(table_name)}
            assert set(index_names) <= indexes

        with engine.connect() as connection:
            post_plan = connection.exec_driver_sql(
                "EXPLAIN QUERY PLAN SELECT id FROM posts "
                "WHERE author_id = 1 ORDER BY created_at DESC, id DESC LIMIT 20"
            ).all()
            topic_plan = connection.exec_driver_sql(
                "EXPLAIN QUERY PLAN SELECT id FROM posts "
                "WHERE topic = '技术' ORDER BY created_at DESC, id DESC LIMIT 20"
            ).all()
            user_plan = connection.exec_driver_sql(
                "EXPLAIN QUERY PLAN SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20"
            ).all()

        assert any("ix_posts_author_created_at_id" in row[-1] for row in post_plan)
        assert any("ix_posts_topic_created_at_id" in row[-1] for row in topic_plan)
        assert any("ix_users_created_at_id" in row[-1] for row in user_plan)
        post_indexes = {item["name"] for item in inspect(engine).get_indexes("posts")}
        assert "ix_posts_topic" not in post_indexes
        assert "ix_posts_author_id" not in post_indexes

        ensure_schema(engine)
        post_indexes = {item["name"] for item in inspect(engine).get_indexes("posts")}
        assert "ix_posts_topic" not in post_indexes
        assert "ix_posts_author_id" not in post_indexes
    finally:
        engine.dispose()
