"""活动访问权限、发布状态和日历下载。"""

from datetime import datetime, timedelta, timezone

import pytest
from eth_account import Account

from app.config import settings


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def event_payload(**overrides):
    starts_at = datetime.now(timezone.utc) + timedelta(days=3)
    payload = {
        "title": "社区共建日",
        "summary": "一起做点东西",
        "content": "## 议程\n\n交流与共建",
        "organizer": "BUPT3DAO",
        "location": "北京邮电大学",
        "starts_at": starts_at.isoformat(),
        "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        "registration_url": "https://example.com/register",
        "registration_deadline": None,
        "materials": "",
    }
    return payload | overrides


def create_published(client, admin_auth, **overrides):
    response = client.post("/api/admin/events", headers=admin_auth, json=event_payload(**overrides))
    assert response.status_code == 201, response.text
    event_id = response.json()["id"]
    published = client.post(f"/api/admin/events/{event_id}/publish", headers=admin_auth)
    assert published.status_code == 200, published.text
    return event_id, published.json()


def test_events_require_login_and_do_not_cache_private_content(client, admin_auth, auth):
    event_id, _ = create_published(client, admin_auth)

    assert client.get("/api/events").status_code == 401
    assert client.get(f"/api/events/{event_id}").status_code == 401
    assert client.get(f"/api/events/{event_id}/calendar.ics").status_code == 401

    listed = client.get("/api/events", headers=auth)
    assert listed.status_code == 200
    assert listed.headers["cache-control"] == "private, no-store"
    assert listed.json()["items"][0]["title"] == "社区共建日"

    calendar = client.get(f"/api/events/{event_id}/calendar.ics", headers=auth)
    assert calendar.status_code == 200
    assert calendar.headers["cache-control"] == "private, no-store"
    assert calendar.headers["content-type"].startswith("text/calendar")
    assert "SUMMARY:社区共建日" in calendar.text
    assert "DTSTART:" in calendar.text


def test_event_drafts_are_admin_only_and_admin_routes_require_admin(client, auth, admin_auth):
    draft = client.post("/api/admin/events", headers=admin_auth, json=event_payload()).json()
    event_id = draft["id"]

    public_items = client.get("/api/events", headers=auth).json()["items"]
    assert all(item["id"] != event_id for item in public_items)
    assert client.get(f"/api/events/{event_id}", headers=auth).status_code == 404
    assert client.get("/api/admin/events", headers=auth).status_code == 403
    assert client.post(f"/api/admin/events/{event_id}/publish", headers=auth).status_code == 403


def test_publish_validation_and_https_registration_validation(client, admin_auth):
    invalid = client.post(
        "/api/admin/events",
        headers=admin_auth,
        json=event_payload(registration_url="javascript:alert(1)"),
    )
    assert invalid.status_code == 422

    payload = event_payload()
    payload["ends_at"] = payload["starts_at"]
    draft = client.post("/api/admin/events", headers=admin_auth, json=payload).json()
    response = client.post(f"/api/admin/events/{draft['id']}/publish", headers=admin_auth)
    assert response.status_code == 422


def test_publish_defaults_registration_deadline_and_normalizes_utc(client, admin_auth):
    starts_at = datetime.now(timezone.utc) + timedelta(days=3)
    payload = event_payload(
        starts_at=starts_at.astimezone(timezone(timedelta(hours=8))).isoformat(),
        registration_deadline=None,
    )
    draft = client.post("/api/admin/events", headers=admin_auth, json=payload).json()
    assert datetime.fromisoformat(draft["ends_at"]) > datetime.fromisoformat(draft["starts_at"]), (
        draft
    )
    published = client.post(f"/api/admin/events/{draft['id']}/publish", headers=admin_auth)

    assert published.status_code == 200, published.text
    body = published.json()
    assert datetime.fromisoformat(body["starts_at"]).utcoffset() == timedelta(0)
    assert body["registration_deadline"] == body["starts_at"]
    assert body["registration_open"] is True


def test_upcoming_includes_ongoing_and_past_uses_end_time(client, admin_auth, auth):
    now = datetime.now(timezone.utc)
    event_id, _ = create_published(
        client,
        admin_auth,
        starts_at=(now - timedelta(hours=1)).isoformat(),
        ends_at=(now + timedelta(hours=1)).isoformat(),
        registration_url=None,
    )

    upcoming = client.get("/api/events?period=upcoming", headers=auth).json()
    past = client.get("/api/events?period=past", headers=auth).json()
    event = next(item for item in upcoming["items"] if item["id"] == event_id)
    assert event["event_state"] == "ongoing"
    assert event_id not in [item["id"] for item in past["items"]]


def test_cancelled_events_stay_visible_but_cannot_register_or_download(client, admin_auth, auth):
    event_id, _ = create_published(client, admin_auth)
    cancelled = client.post(
        f"/api/admin/events/{event_id}/cancel",
        headers=admin_auth,
        json={"reason": "场地临时调整"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["event_state"] == "cancelled"
    assert cancelled.json()["registration_open"] is False
    assert cancelled.json()["cancellation_reason"] == "场地临时调整"
    assert client.get(f"/api/events/{event_id}", headers=auth).status_code == 200
    assert client.get(f"/api/events/{event_id}/calendar.ics", headers=auth).status_code == 404
    past = client.get("/api/events?period=past", headers=auth).json()
    assert past["total"] == 1


def test_withdraw_hides_event_and_cancel_reason_is_required(client, admin_auth, auth):
    event_id, _ = create_published(client, admin_auth)
    response = client.post(f"/api/admin/events/{event_id}/withdraw", headers=admin_auth)
    assert response.status_code == 200
    assert client.get(f"/api/events/{event_id}", headers=auth).status_code == 404

    another, _ = create_published(client, admin_auth)
    assert (
        client.post(
            f"/api/admin/events/{another}/cancel", headers=admin_auth, json={"reason": "  "}
        ).status_code
        == 422
    )
