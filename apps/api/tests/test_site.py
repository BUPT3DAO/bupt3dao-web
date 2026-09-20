"""首页社区群二维码：公开读取、管理员更换与移除。"""

import io

import pytest
from eth_account import Account
from fastapi.testclient import TestClient

from app.config import settings

# 1x1 透明 PNG
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def _upload(client: TestClient, auth: dict[str, str], name: str = "qrcode.png"):
    return client.post(
        "/api/admin/site/qrcode",
        files={"file": (name, io.BytesIO(_PNG_BYTES), "image/png")},
        headers=auth,
    )


def test_site_config_is_public_and_empty_by_default(client: TestClient) -> None:
    response = client.get("/api/site")

    assert response.status_code == 200
    assert response.json()["group_qrcode_url"] is None


def test_upload_qrcode_requires_admin(client: TestClient, auth: dict[str, str]) -> None:
    assert _upload(client, {}).status_code == 401
    # 已登录但不是管理员
    assert _upload(client, auth).status_code == 403


def test_admin_upload_and_replace_qrcode(client: TestClient, admin_auth: dict[str, str]) -> None:
    first = _upload(client, admin_auth)
    assert first.status_code == 200
    first_url = first.json()["group_qrcode_url"]
    assert first_url.startswith("/uploads/")
    assert client.get(first_url).status_code == 200
    assert client.get("/api/site").json()["group_qrcode_url"] == first_url

    second = _upload(client, admin_auth)
    assert second.status_code == 200
    second_url = second.json()["group_qrcode_url"]
    assert second_url != first_url
    # 旧图随替换被删除，避免上传目录堆积
    assert client.get(first_url).status_code == 404


def test_upload_qrcode_rejects_non_image(client: TestClient, admin_auth: dict[str, str]) -> None:
    response = client.post(
        "/api/admin/site/qrcode",
        files={"file": ("note.txt", io.BytesIO(b"hello"), "text/plain")},
        headers=admin_auth,
    )

    assert response.status_code == 400


def test_admin_remove_qrcode(client: TestClient, admin_auth: dict[str, str]) -> None:
    url = _upload(client, admin_auth).json()["group_qrcode_url"]

    removed = client.delete("/api/admin/site/qrcode", headers=admin_auth)

    assert removed.status_code == 204
    assert client.get("/api/site").json()["group_qrcode_url"] is None
    assert client.get(url).status_code == 404
    # 重复移除保持幂等
    assert client.delete("/api/admin/site/qrcode", headers=admin_auth).status_code == 204
