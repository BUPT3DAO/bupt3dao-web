"""三级评论：结构、权限与封禁可见性。"""

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


def test_three_level_thread_is_returned_as_tree(client, auth, sign_in):
    post = _create_post(client, auth)
    other = sign_in(Account.create())

    root = _comment(client, other, post["id"], "一楼")
    second = _comment(client, auth, post["id"], "回复一楼", root["id"])
    third = _comment(client, other, post["id"], "回复回复", second["id"])

    assert (root["depth"], second["depth"], third["depth"]) == (1, 2, 3)

    # 第四级被拒绝
    rejected = client.post(
        f"/api/posts/{post['id']}/comments",
        json={"content": "第四级", "parent_id": third["id"]},
        headers=auth,
    )
    assert rejected.status_code == 409

    listed = client.get(f"/api/posts/{post['id']}/comments").json()
    assert listed["total"] == 3
    assert len(listed["items"]) == 1
    assert listed["items"][0]["content"] == "一楼"
    assert listed["items"][0]["replies"][0]["content"] == "回复一楼"
    assert listed["items"][0]["replies"][0]["replies"][0]["content"] == "回复回复"

    # 列表与详情都会带上评论数
    assert client.get(f"/api/posts/{post['id']}").json()["comment_count"] == 3
    feed = client.get("/api/posts?limit=100").json()["items"]
    assert next(item for item in feed if item["id"] == post["id"])["comment_count"] == 3


def test_comment_threads_are_paginated_without_splitting_replies(client, auth):
    post = _create_post(client, auth)
    _comment(client, auth, post["id"], "第一个主题")
    _comment(client, auth, post["id"], "第二个主题")
    _comment(client, auth, post["id"], "第三个主题")
    first_root = _comment(client, auth, post["id"], "最新主题")
    first_reply = _comment(client, auth, post["id"], "主题回复", first_root["id"])
    _comment(client, auth, post["id"], "回复的回复", first_reply["id"])

    first_page = client.get(f"/api/posts/{post['id']}/comments?limit=2").json()
    assert first_page["total"] == 6
    assert first_page["has_more"] is True
    assert [comment["content"] for comment in first_page["items"]] == ["最新主题", "第三个主题"]
    assert first_page["items"][0]["replies"][0]["replies"][0]["content"] == "回复的回复"

    second_page = client.get(f"/api/posts/{post['id']}/comments?limit=2&offset=2").json()
    assert second_page["has_more"] is False
    assert [comment["content"] for comment in second_page["items"]] == ["第二个主题", "第一个主题"]


def test_comment_permissions(client, auth, sign_in, admin_auth):
    post = _create_post(client, auth)
    root = _comment(client, auth, post["id"], "我的评论")

    assert (
        client.post(f"/api/posts/{post['id']}/comments", json={"content": "匿名评论"}).status_code
        == 401
    )
    assert (
        client.post(
            f"/api/posts/{post['id']}/comments", json={"content": "   "}, headers=auth
        ).status_code
        == 422
    )

    other = sign_in(Account.create())
    assert (
        client.delete(f"/api/posts/{post['id']}/comments/{root['id']}", headers=other).status_code
        == 403
    )
    assert (
        client.delete(
            f"/api/posts/{post['id']}/comments/{root['id']}", headers=admin_auth
        ).status_code
        == 204
    )


def test_invalid_targets_are_rejected(client, auth):
    post = _create_post(client, auth)
    assert client.get("/api/posts/999999/comments").status_code == 404
    assert (
        client.post("/api/posts/999999/comments", json={"content": "x"}, headers=auth).status_code
        == 404
    )
    # 回复一个不存在的评论
    assert (
        client.post(
            f"/api/posts/{post['id']}/comments",
            json={"content": "x", "parent_id": 999999},
            headers=auth,
        ).status_code
        == 404
    )
    # 回复另一个帖子下的评论
    other_post = _create_post(client, auth, title="另一个帖子")
    root = _comment(client, auth, other_post["id"], "别处的一楼")
    assert (
        client.post(
            f"/api/posts/{post['id']}/comments",
            json={"content": "x", "parent_id": root["id"]},
            headers=auth,
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/posts/{post['id']}/comments/{root['id']}", headers=auth).status_code
        == 404
    )


def test_deleting_root_removes_its_replies(client, auth):
    post = _create_post(client, auth)
    root = _comment(client, auth, post["id"], "一楼")
    second = _comment(client, auth, post["id"], "回复一楼", root["id"])
    _comment(client, auth, post["id"], "回复回复", second["id"])

    assert (
        client.delete(f"/api/posts/{post['id']}/comments/{root['id']}", headers=auth).status_code
        == 204
    )
    listed = client.get(f"/api/posts/{post['id']}/comments").json()
    assert listed["total"] == 0
    assert listed["items"] == []


def test_banned_author_comments_are_hidden(client, auth, sign_in, admin_auth):
    post = _create_post(client, auth)
    root = _comment(client, auth, post["id"], "会被隐藏的一楼")

    troll = Account.create()
    troll_headers = sign_in(troll)
    _comment(client, troll_headers, post["id"], "封禁后隐藏的回复", root["id"])

    client.patch(
        f"/api/admin/users/{troll.address.lower()}/ban",
        headers=admin_auth,
        json={"is_banned": True},
    )

    listed = client.get(f"/api/posts/{post['id']}/comments").json()
    assert listed["total"] == 1
    assert listed["items"][0]["id"] == root["id"]
    # 封禁作者的回复隐藏，但其父评论仍可见
    assert listed["items"][0]["replies"] == []
    assert client.get(f"/api/posts/{post['id']}").json()["comment_count"] == 1
    feed = client.get("/api/posts?limit=100").json()["items"]
    assert next(item for item in feed if item["id"] == post["id"])["comment_count"] == 1


def test_visible_reply_under_banned_root_is_not_counted(client, auth, sign_in, admin_auth):
    troll = Account.create()
    troll_headers = sign_in(troll)
    post = _create_post(client, auth)
    root = _comment(client, troll_headers, post["id"], "封禁后隐藏的主题")
    _comment(client, auth, post["id"], "父评论不可见，因此也不展示", root["id"])

    client.patch(
        f"/api/admin/users/{troll.address.lower()}/ban",
        headers=admin_auth,
        json={"is_banned": True},
    )

    listed = client.get(f"/api/posts/{post['id']}/comments").json()
    assert listed["items"] == []
    assert listed["total"] == 0
    assert client.get(f"/api/posts/{post['id']}").json()["comment_count"] == 0
    feed = client.get("/api/posts?limit=100").json()["items"]
    assert next(item for item in feed if item["id"] == post["id"])["comment_count"] == 0


def test_banned_member_cannot_comment(client, auth, sign_in, admin_auth):
    post = _create_post(client, auth)
    troll = Account.create()
    troll_headers = sign_in(troll)
    client.patch(
        f"/api/admin/users/{troll.address.lower()}/ban",
        headers=admin_auth,
        json={"is_banned": True},
    )
    assert (
        client.post(
            f"/api/posts/{post['id']}/comments",
            json={"content": "继续发言"},
            headers=troll_headers,
        ).status_code
        == 403
    )
