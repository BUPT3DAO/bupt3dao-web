import io

from fastapi.testclient import TestClient

# 1x1 透明 PNG
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


def test_update_profile(client: TestClient, auth: dict[str, str]) -> None:
    response = client.patch(
        "/api/users/me",
        json={"nickname": "  链协小助手  ", "bio": "我在北邮玩区块链"},
        headers=auth,
    )

    assert response.status_code == 200
    assert response.json()["nickname"] == "链协小助手"
    assert response.json()["bio"] == "我在北邮玩区块链"


def test_update_profile_requires_login(client: TestClient) -> None:
    assert client.patch("/api/users/me", json={"nickname": "x"}).status_code == 401


def test_public_profile_shows_post_count(client: TestClient, auth: dict[str, str]) -> None:
    client.post("/api/posts", json={"content": "数一数"}, headers=auth)
    address = client.get("/api/auth/me", headers=auth).json()["address"]

    profile = client.get(f"/api/users/{address}")

    assert profile.status_code == 200
    assert profile.json()["address"] == address
    assert profile.json()["post_count"] >= 1


def test_unknown_user_returns_404(client: TestClient) -> None:
    response = client.get("/api/users/0x0000000000000000000000000000000000000001")

    assert response.status_code == 404


def test_upload_avatar(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post(
        "/api/users/me/avatar",
        files={"file": ("avatar.png", io.BytesIO(_PNG_BYTES), "image/png")},
        headers=auth,
    )

    assert response.status_code == 200
    avatar_url = response.json()["avatar_url"]
    assert avatar_url is not None
    assert avatar_url.startswith("/uploads/")
    assert client.get(avatar_url).status_code == 200


def test_upload_avatar_rejects_non_image(client: TestClient, auth: dict[str, str]) -> None:
    response = client.post(
        "/api/users/me/avatar",
        files={"file": ("note.txt", io.BytesIO(b"hello"), "text/plain")},
        headers=auth,
    )

    assert response.status_code == 400


def test_invalid_address_returns_400(client: TestClient) -> None:
    assert client.get("/api/users/not-an-address").status_code == 400
    assert client.get("/api/users/not-an-address/posts").status_code == 400
