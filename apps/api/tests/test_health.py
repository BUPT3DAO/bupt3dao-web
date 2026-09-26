from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.db import get_db
from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_reports_database_failure(monkeypatch) -> None:
    class BrokenSession:
        def execute(self, _statement):
            raise SQLAlchemyError("database unavailable")

    def broken_db():
        yield BrokenSession()

    monkeypatch.setitem(app.dependency_overrides, get_db, broken_db)
    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json()["detail"] == "数据库暂不可用"
