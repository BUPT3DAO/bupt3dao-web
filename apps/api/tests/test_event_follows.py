"""Event follows, unified inbox privacy, and scheduled reminder behavior."""

from datetime import datetime, timedelta, timezone

import pytest
from eth_account import Account
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.event_service import deliver_due_reminders
from app.models import EventNotification


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def event_payload(**overrides):
    starts_at = datetime.now(timezone.utc) + timedelta(days=3)
    return {
        "title": "社区共建日",
        "summary": "一起做点东西",
        "content": "交流与共建",
        "organizer": "BUPT3DAO",
        "location": "北京邮电大学",
        "starts_at": starts_at.isoformat(),
        "ends_at": (starts_at + timedelta(hours=2)).isoformat(),
        "registration_url": "https://example.com/register",
        "registration_deadline": None,
        "materials": "",
    } | overrides


def create_published(client, admin_auth, **overrides):
    payload = event_payload(**overrides)
    draft = client.post("/api/admin/events", headers=admin_auth, json=payload)
    assert draft.status_code == 201, draft.text
    event_id = draft.json()["id"]
    published = client.post(f"/api/admin/events/{event_id}/publish", headers=admin_auth)
    assert published.status_code == 200, published.text
    return event_id, payload


def test_follow_preferences_mine_and_unfollow(client, admin_auth, auth):
    event_id, _ = create_published(client, admin_auth)
    assert client.get("/api/events/mine", headers=auth).json()["total"] == 0
    followed = client.put(
        f"/api/events/{event_id}/follow",
        headers=auth,
        json={"reminder_preference": "24h_1h"},
    )
    assert followed.status_code == 200
    assert followed.json() == {"followed": True, "reminder_preference": "24h_1h"}
    assert (
        client.put(
            f"/api/events/{event_id}/follow", headers=auth, json={"reminder_preference": "none"}
        ).status_code
        == 200
    )
    assert client.get(f"/api/events/{event_id}", headers=auth).json()["followed"] is True
    assert client.get("/api/events/mine", headers=auth).json()["total"] == 1
    assert client.delete(f"/api/events/{event_id}/follow", headers=auth).status_code == 200
    assert client.get("/api/events/mine", headers=auth).json()["total"] == 0
    assert client.put(f"/api/events/{event_id}/follow", json={}).status_code == 401


def test_unified_inbox_merges_categories_and_keeps_read_ownership(
    client, admin_auth, auth, sign_in
):
    event_id, payload = create_published(client, admin_auth)
    client.put(f"/api/events/{event_id}/follow", headers=auth, json={})

    post = client.post(
        "/api/posts", headers=auth, json={"title": "讨论", "topic": "技术交流", "content": "正文"}
    ).json()
    commenter = sign_in(Account.create())
    client.post(f"/api/posts/{post['id']}/comments", headers=commenter, json={"content": "回复"})
    client.put(
        f"/api/admin/events/{event_id}",
        headers=admin_auth,
        json=payload | {"location": "线上会议"},
    )

    feed = client.get("/api/inbox?category=all", headers=auth)
    assert feed.status_code == 200, feed.text
    assert {item["source"] for item in feed.json()["items"]} == {"community", "event"}
    assert feed.json()["unread"] == 2
    community_item = next(item for item in feed.json()["items"] if item["source"] == "community")
    assert (
        client.post(
            f"/api/inbox/community/{community_item['id']}/read", headers=commenter
        ).status_code
        == 404
    )
    marked = client.post(f"/api/inbox/community/{community_item['id']}/read", headers=auth)
    assert marked.status_code == 200
    assert marked.json()["unread"] == 1


def test_published_changes_notify_followers_once_and_withdrawn_content_is_redacted(
    client, admin_auth, auth
):
    event_id, original_payload = create_published(client, admin_auth)
    client.put(f"/api/events/{event_id}/follow", headers=auth, json={})
    updated = client.put(
        f"/api/admin/events/{event_id}",
        headers=admin_auth,
        json=original_payload | {"location": "线上会议", "materials": "讲义已上传"},
    )
    assert updated.status_code == 200
    assert updated.json()["followers_notified"] == 1
    feed = client.get("/api/inbox?category=event", headers=auth)
    assert feed.status_code == 200
    assert feed.headers["cache-control"] == "private, no-store"
    assert feed.json()["total"] == 1
    assert "地点" in feed.json()["items"][0]["message"]
    unchanged = client.put(
        f"/api/admin/events/{event_id}",
        headers=admin_auth,
        json=original_payload | {"location": "线上会议", "materials": "讲义已上传"},
    )
    assert unchanged.json()["followers_notified"] == 0
    assert client.get("/api/inbox?category=event", headers=auth).json()["total"] == 1

    withdrawn = client.post(f"/api/admin/events/{event_id}/withdraw", headers=admin_auth)
    assert withdrawn.status_code == 200
    mine = client.get("/api/events/mine?period=all", headers=auth).json()["items"][0]
    assert mine["title"] == "活动已撤回"
    assert mine["location"] == ""
    assert mine["content"] == ""
    feed = client.get("/api/inbox?category=event", headers=auth).json()
    assert all(item["title"] == "活动已撤回" for item in feed["items"])
    assert all("线上会议" not in item["message"] for item in feed["items"])


def test_cancellation_notifies_followers_and_keeps_existing_follow_removable(
    client, admin_auth, auth
):
    event_id, _ = create_published(client, admin_auth)
    client.put(f"/api/events/{event_id}/follow", headers=auth, json={})
    cancelled = client.post(
        f"/api/admin/events/{event_id}/cancel",
        headers=admin_auth,
        json={"reason": "场地临时调整"},
    )
    assert cancelled.status_code == 200
    feed = client.get("/api/inbox?category=event", headers=auth).json()
    assert any("场地临时调整" in item["message"] for item in feed["items"])
    assert client.put(f"/api/events/{event_id}/follow", headers=auth, json={}).status_code == 409
    assert client.delete(f"/api/events/{event_id}/follow", headers=auth).json()["followed"] is False


def test_reminder_worker_delivers_both_offsets_once_and_skips_stale_schedule(
    client, admin_auth, auth
):
    now = datetime.now(timezone.utc)
    starts = now + timedelta(hours=25)
    event_id, payload = create_published(
        client,
        admin_auth,
        starts_at=starts.isoformat(),
        ends_at=(starts + timedelta(hours=2)).isoformat(),
    )
    client.put(
        f"/api/events/{event_id}/follow",
        headers=auth,
        json={"reminder_preference": "24h_1h"},
    )
    with SessionLocal() as db:
        assert deliver_due_reminders(db, now + timedelta(hours=2)) == 1
        assert deliver_due_reminders(db, now + timedelta(hours=2)) == 0
        assert deliver_due_reminders(db, starts - timedelta(minutes=30)) == 1
        assert deliver_due_reminders(db, starts - timedelta(minutes=30)) == 0
        rows = db.scalars(
            select(EventNotification).where(
                EventNotification.event_id == event_id,
                EventNotification.kind == "event_reminder",
            )
        ).all()
        assert {row.reminder_offset for row in rows} == {1, 24}

    rescheduled = starts + timedelta(days=1)
    changed = client.put(
        f"/api/admin/events/{event_id}",
        headers=admin_auth,
        json=payload
        | {
            "starts_at": rescheduled.isoformat(),
            "ends_at": (rescheduled + timedelta(hours=2)).isoformat(),
        },
    )
    assert changed.status_code == 200
    feed = client.get("/api/inbox?category=event", headers=auth).json()
    stale_reminders = [item for item in feed["items"] if item["kind"] == "event_reminder"]
    assert len(stale_reminders) == 2
    assert all(item["is_read"] and item["is_stale"] for item in stale_reminders)
    assert feed["unread"] == 1
