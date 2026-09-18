from eth_account import Account
from eth_account.signers.local import LocalAccount
from fastapi.testclient import TestClient


def test_create_post_appears_in_feed(
    client: TestClient, auth: dict[str, str], wallet: LocalAccount
) -> None:
    created = client.post("/api/posts", json={"content": "  第一条帖子  "}, headers=auth)

    assert created.status_code == 201
    body = created.json()
    assert body["content"] == "第一条帖子"
    assert body["author"]["address"] == wallet.address.lower()

    feed = client.get("/api/posts")
    assert feed.status_code == 200
    assert body["id"] in [item["id"] for item in feed.json()["items"]]


def test_create_post_requires_login(client: TestClient) -> None:
    assert client.post("/api/posts", json={"content": "匿名发帖"}).status_code == 401


def test_blank_post_is_rejected(client: TestClient, auth: dict[str, str]) -> None:
    assert client.post("/api/posts", json={"content": "   "}, headers=auth).status_code == 422


def test_author_can_delete_own_post(client: TestClient, auth: dict[str, str]) -> None:
    post_id = client.post("/api/posts", json={"content": "待删除"}, headers=auth).json()["id"]

    assert client.delete(f"/api/posts/{post_id}", headers=auth).status_code == 204
    assert client.delete(f"/api/posts/{post_id}", headers=auth).status_code == 404


def test_cannot_delete_others_post(client: TestClient, auth: dict[str, str], sign_in) -> None:
    post_id = client.post("/api/posts", json={"content": "别人的帖子"}, headers=auth).json()["id"]
    other_headers = sign_in(Account.create())

    assert client.delete(f"/api/posts/{post_id}", headers=other_headers).status_code == 403
    assert client.delete(f"/api/posts/{post_id}", headers=auth).status_code == 204
