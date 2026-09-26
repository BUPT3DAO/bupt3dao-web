from sqlalchemy import create_engine

from app.db import engine


def test_file_backed_sqlite_uses_write_ahead_logging() -> None:
    with engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA journal_mode").scalar() == "wal"
        assert connection.exec_driver_sql("PRAGMA synchronous").scalar() == 1


def test_in_memory_sqlite_keeps_memory_journal() -> None:
    memory_engine = create_engine("sqlite://")
    try:
        with memory_engine.connect() as connection:
            assert connection.exec_driver_sql("PRAGMA journal_mode").scalar() == "memory"
    finally:
        memory_engine.dispose()
