"""站内消息：回复投递、已读、清理与封禁可见性。"""

import pytest
from eth_account import Account
from fastapi.testclient import TestClient

from app.config import settings


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def _create_post(client: TestClient, auth: dict[str, str], title: str = "聊聊 SIWE") -> dict:
    response = client.post(
        "/api/posts",
        json={"title": title, "topic": "技术交流", "content": "正文"},
        headers=auth,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _comment(
    client: TestClient,
    auth: dict[str, str],
    post_id: int,
    content: str,
    parent_id: int | None = None,
) -> dict:
    payload: dict[str, object] = {"content": content}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    response = client.post(f"/api/posts/{post_id}/comments", json=payload, headers=auth)
    assert response.status_code == 201, response.text
    return response.json()


def _feed(client: TestClient, auth: dict[str, str]) -> dict:
    response = client.get("/api/notifications", headers=auth)
    assert response.status_code == 200, response.text
    return response.json()


def test_commenting_on_a_post_notifies_its_author(client, auth, sign_in):
    wallet = Account.create()
    other_auth = sign_in(wallet)
    post = _create_post(client, auth)
    comment = _comment(client, other_auth, post["id"], "支持一下")

    feed = _feed(client, auth)
    assert (feed["total"], feed["unread"]) == (1, 1)
    item = feed["items"][0]
    assert item["kind"] == "post_comment"
    assert item["is_read"] is False
    assert item["post_id"] == post["id"]
    assert item["post_title"] == post["title"]
    assert item["comment_id"] == comment["id"]
    assert item["excerpt"] == "支持一下"
    assert item["actor"]["address"] == wallet.address.lower()

    # 评论者自己没有消息，未被回复的人也不该收到
    assert _feed(client, other_auth)["total"] == 0


def test_reply_notifies_the_replied_author(client, sign_in):
    author_wallet = Account.create()
    author_auth = sign_in(author_wallet)
    other_auth = sign_in(Account.create())
    post = _create_post(client, author_auth)
    root = _comment(client, other_auth, post["id"], "一楼")
    reply = _comment(client, author_auth, post["id"], "回复一楼", root["id"])

    feed = _feed(client, other_auth)
    assert (feed["total"], feed["unread"]) == (1, 1)
    item = feed["items"][0]
    assert item["kind"] == "comment_reply"
    assert item["comment_id"] == reply["id"]
    assert item["post_id"] == post["id"]
    assert item["actor"]["address"] == author_wallet.address.lower()
    # 帖子作者收到的仍是「评论了你的帖子」那一条
    assert [row["kind"] for row in _feed(client, author_auth)["items"]] == ["post_comment"]


def test_own_actions_never_notify_yourself(client, auth):
    post = _create_post(client, auth)
    root = _comment(client, auth, post["id"], "自己的一楼")
    _comment(client, auth, post["id"], "自己回复自己", root["id"])

    assert _feed(client, auth) == {"items": [], "total": 0, "unread": 0}


def test_mark_read_updates_unread_and_is_scoped_to_owner(client, auth, sign_in):
    other_auth = sign_in(Account.create())
    post = _create_post(client, auth)
    _comment(client, other_auth, post["id"], "第一条")
    _comment(client, other_auth, post["id"], "第二条")
    unread_id, read_id = [row["id"] for row in _feed(client, auth)["items"]]

    assert client.post(f"/api/notifications/{unread_id}/read").status_code == 401
    # 别人的消息一律当作不存在
    assert (
        client.post(f"/api/notifications/{unread_id}/read", headers=other_auth).status_code == 404
    )

    response = client.post(f"/api/notifications/{unread_id}/read", headers=auth)
    assert response.status_code == 200
    assert response.json() == {"unread": 1}
    # 重复标记已读不报错，结果不变
    assert client.post(f"/api/notifications/{unread_id}/read", headers=auth).json() == {"unread": 1}

    feed = _feed(client, auth)
    flags = {row["id"]: row["is_read"] for row in feed["items"]}
    assert flags == {unread_id: True, read_id: False}
    assert client.get("/api/notifications/summary", headers=auth).json() == {"unread": 1}


def test_latest_message_comes_first(client, auth, sign_in):
    other_auth = sign_in(Account.create())
    post = _create_post(client, auth)
    _comment(client, other_auth, post["id"], "先发的")
    _comment(client, other_auth, post["id"], "后发的")

    excerpts = [row["excerpt"] for row in _feed(client, auth)["items"]]
    assert excerpts == ["后发的", "先发的"]

    # 分页一次只取一条
    paged = client.get("/api/notifications?limit=1", headers=auth).json()
    assert [row["excerpt"] for row in paged["items"]] == ["后发的"]
    assert paged["total"] == 2


def test_deleting_a_post_clears_its_notifications(client, auth, sign_in):
    other_auth = sign_in(Account.create())
    post = _create_post(client, auth)
    _comment(client, other_auth, post["id"], "会被清理掉的评论")

    assert client.delete(f"/api/posts/{post['id']}", headers=auth).status_code == 204
    assert _feed(client, auth) == {"items": [], "total": 0, "unread": 0}


def test_deleting_a_root_comment_clears_replies_notifications(client, auth, sign_in):
    wallet = Account.create()
    other_auth = sign_in(wallet)
    post = _create_post(client, auth)
    root = _comment(client, other_auth, post["id"], "一楼")
    reply = _comment(client, auth, post["id"], "回复一楼", root["id"])
    _comment(client, other_auth, post["id"], "回复回复", reply["id"])

    assert (len(_feed(client, auth)["items"]), len(_feed(client, other_auth)["items"])) == (2, 1)
    deleted = client.delete(f"/api/posts/{post['id']}/comments/{root['id']}", headers=other_auth)
    assert deleted.status_code == 204
    # 一级评论连回复一起删除，对应的消息也要跟着消失
    assert _feed(client, auth)["total"] == 0
    assert _feed(client, other_auth)["total"] == 0


def test_banned_actor_messages_are_hidden(client, auth, sign_in, admin_auth):
    troll = Account.create()
    troll_auth = sign_in(troll)
    post = _create_post(client, auth)
    _comment(client, troll_auth, post["id"], "封禁前的发言")
    assert _feed(client, auth)["unread"] == 1

    client.patch(
        f"/api/admin/users/{troll.address.lower()}/ban",
        headers=admin_auth,
        json={"is_banned": True},
    )
    assert _feed(client, auth) == {"items": [], "total": 0, "unread": 0}
