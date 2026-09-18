from eth_account import Account
from eth_account.signers.local import LocalAccount
from fastapi.testclient import TestClient


def test_create_post_appears_in_feed(
    client: TestClient, auth: dict[str, str], wallet: LocalAccount
) -> None:
    created = client.post(
        "/api/posts",
        json={"title": "  第一篇帖子  ", "topic": "技术交流", "content": "  正文内容  "},
        headers=auth,
    )

    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "第一篇帖子"
    assert body["content"] == "正文内容"
    assert body["topic"] == "技术交流"
    assert body["comment_count"] == 0
    assert body["author"]["address"] == wallet.address.lower()

    feed = client.get("/api/posts")
    assert feed.status_code == 200
    item = next(item for item in feed.json()["items"] if item["id"] == body["id"])
    assert item["title"] == "第一篇帖子"
    # 列表接口不下发正文，正文只在详情页取
    assert "content" not in item

    detail = client.get(f"/api/posts/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["content"] == "正文内容"


def test_filter_posts_by_topic_and_keyword(client: TestClient, auth: dict[str, str]) -> None:
    # 用例之间共用一个测试库，这里用唯一标记把数据隔离出来
    marker = "ZQ7X"
    client.post(
        "/api/posts",
        json={"title": f"{marker} 钱包签名踩坑", "topic": "技术交流", "content": "SIWE 细节"},
        headers=auth,
    )
    client.post(
        "/api/posts",
        json={"title": f"{marker} 周末约球", "topic": "校园日常", "content": "操场见"},
        headers=auth,
    )

    topic = client.get(f"/api/posts?topic=技术交流&q={marker}&limit=100").json()
    assert [item["title"] for item in topic["items"]] == [f"{marker} 钱包签名踩坑"]

    keyword = client.get(f"/api/posts?q={marker} 周末&limit=100").json()
    assert [item["title"] for item in keyword["items"]] == [f"{marker} 周末约球"]

    # 板块与关键字可以叠加，条件冲突时为空
    conflict = client.get(f"/api/posts?topic=校园日常&q={marker} 钱包&limit=100").json()
    assert conflict["total"] == 0


def test_create_post_requires_login(client: TestClient) -> None:
    assert (
        client.post("/api/posts", json={"title": "匿名", "content": "匿名发帖"}).status_code == 401
    )


def test_invalid_post_payload_is_rejected(client: TestClient, auth: dict[str, str]) -> None:
    assert (
        client.post("/api/posts", json={"title": "  ", "content": "正文"}, headers=auth).status_code
        == 422
    )
    assert (
        client.post(
            "/api/posts", json={"title": "标题", "content": "   "}, headers=auth
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/posts",
            json={"title": "标题", "topic": "不存在的板块", "content": "正文"},
            headers=auth,
        ).status_code
        == 422
    )


def test_author_can_delete_own_post(client: TestClient, auth: dict[str, str]) -> None:
    post_id = client.post(
        "/api/posts", json={"title": "待删除", "content": "待删除"}, headers=auth
    ).json()["id"]

    assert client.delete(f"/api/posts/{post_id}", headers=auth).status_code == 204
    assert client.delete(f"/api/posts/{post_id}", headers=auth).status_code == 404


def test_cannot_delete_others_post(client: TestClient, auth: dict[str, str], sign_in) -> None:
    post_id = client.post(
        "/api/posts", json={"title": "别人的帖子", "content": "别人的帖子"}, headers=auth
    ).json()["id"]
    other_headers = sign_in(Account.create())

    assert client.delete(f"/api/posts/{post_id}", headers=other_headers).status_code == 403
    assert client.delete(f"/api/posts/{post_id}", headers=auth).status_code == 204
