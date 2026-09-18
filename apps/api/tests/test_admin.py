import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.config import Settings, settings
from app.db import Base
from app.models import FeaturedMember, User


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def test_admin_requires_authorization(client, auth):
    paths = ["/api/admin/users", "/api/admin/posts"]
    for path in paths:
        assert client.get(path).status_code == 401
        assert client.get(path, headers=auth).status_code == 403
    address = client.get("/api/auth/me", headers=auth).json()["address"]
    assert (
        client.patch(
            f"/api/admin/users/{address}/ban", headers=auth, json={"is_banned": True}
        ).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/admin/members/{address}", headers=auth, json={"title": "校友"}
        ).status_code
        == 403
    )
    assert client.delete(f"/api/admin/members/{address}", headers=auth).status_code == 403
    assert client.patch("/api/users/me", headers=auth, json={"is_admin": True}).status_code == 422


def test_admin_can_delete_others_posts(client, admin_auth, auth):
    post = client.post("/api/posts", headers=auth, json={"content": "待管理帖子"}).json()
    result = client.get("/api/admin/posts?q=待管理帖子", headers=admin_auth)
    assert any(p["id"] == post["id"] for p in result.json()["items"])
    assert client.delete(f"/api/posts/{post['id']}", headers=admin_auth).status_code == 204
    assert client.delete(f"/api/posts/{post['id']}", headers=admin_auth).status_code == 404


def test_feature_update_search_remove(client, admin_auth, auth):
    me = client.get("/api/auth/me", headers=auth).json()
    address = me["address"]
    payload = {
        "title": "开源贡献者",
        "cohort": "2024 届",
        "introduction": "参与社团建设",
        "sort_order": 5,
    }
    assert (
        client.put(f"/api/admin/members/{address}", headers=admin_auth, json=payload).status_code
        == 200
    )
    members = client.get("/api/members?q=2024").json()
    assert any(item["user"]["address"] == address for item in members["items"])
    payload["title"] = "社区共建者"
    client.put(f"/api/admin/members/{address}", headers=admin_auth, json=payload)
    result = client.get(
        f"/api/admin/users?q={address}&featured_only=true", headers=admin_auth
    ).json()
    assert result["total"] == 1
    assert result["items"][0]["featured"]["title"] == "社区共建者"
    assert client.delete(f"/api/admin/members/{address}", headers=admin_auth).status_code == 204
    assert (
        client.get(f"/api/admin/users?q={address}&featured_only=true", headers=admin_auth).json()[
            "total"
        ]
        == 0
    )


def test_ban_invalidates_token_login_and_public_content(client, admin_auth, auth, wallet):
    address = wallet.address.lower()
    post = client.post("/api/posts", headers=auth, json={"content": "封禁可见性验证"}).json()
    client.put(f"/api/admin/members/{address}", headers=admin_auth, json={"title": "封禁测试成员"})
    response = client.patch(
        f"/api/admin/users/{address}/ban",
        headers=admin_auth,
        json={"is_banned": True, "reason": "违反社区规则"},
    )
    assert response.status_code == 200
    assert response.json()["is_banned"] is True
    assert client.get("/api/auth/me", headers=auth).status_code == 403
    assert client.post("/api/posts", headers=auth, json={"content": "绕过封禁"}).status_code == 403
    assert (
        client.patch("/api/users/me", headers=auth, json={"nickname": "新昵称"}).status_code == 403
    )
    assert (
        client.post(
            "/api/users/me/avatar", headers=auth, files={"file": ("a.png", b"test", "image/png")}
        ).status_code
        == 403
    )
    assert client.get(f"/api/users/{address}").status_code == 404
    assert client.get(f"/api/users/{address}/posts").status_code == 404
    assert all(p["id"] != post["id"] for p in client.get("/api/posts?limit=100").json()["items"])
    assert client.get("/api/members?q=封禁测试成员").json()["total"] == 0
    assert (
        client.put(
            f"/api/admin/members/{address}", headers=admin_auth, json={"title": "不能上墙"}
        ).status_code
        == 409
    )
    challenge = client.post("/api/auth/nonce", json={"address": address}).json()
    signature = Account.sign_message(encode_defunct(text=challenge["message"]), wallet.key)
    assert (
        client.post(
            "/api/auth/verify",
            json={
                "message": challenge["message"],
                "signature": signature.signature.hex(),
            },
        ).status_code
        == 403
    )
    client.patch(f"/api/admin/users/{address}/ban", headers=admin_auth, json={"is_banned": False})
    assert client.get("/api/auth/me", headers=auth).status_code == 200
    assert client.get("/api/members?q=封禁测试成员").json()["total"] == 1


def test_protect_admin_and_validate_member(client, admin_auth):
    me = client.get("/api/auth/me", headers=admin_auth).json()
    assert me["is_admin"] is True
    assert (
        client.patch(
            f"/api/admin/users/{me['address']}/ban", headers=admin_auth, json={"is_banned": True}
        ).status_code
        == 403
    )
    unknown = Account.create().address
    assert (
        client.put(
            f"/api/admin/members/{unknown}", headers=admin_auth, json={"title": "未注册"}
        ).status_code
        == 404
    )
    assert (
        client.put(
            f"/api/admin/members/{me['address']}", headers=admin_auth, json={"title": "   "}
        ).status_code
        == 422
    )
    assert client.get("/api/admin/users?limit=0", headers=admin_auth).status_code == 422


def test_admin_config_normalizes_addresses():
    wallet = Account.create()
    assert Settings(admin_addresses=[wallet.address]).admin_addresses == [wallet.address.lower()]
    with pytest.raises(ValueError):
        Settings(admin_addresses=["invalid"])


def test_revoked_admin_cannot_reuse_existing_session(client, admin_auth, monkeypatch):
    monkeypatch.setattr(settings, "admin_addresses", [])
    assert client.get("/api/admin/users", headers=admin_auth).status_code == 403
    assert client.get("/api/auth/me", headers=admin_auth).json()["is_admin"] is False


def test_wall_pagination_order_and_literal_search(client, admin_auth, sign_in):
    addresses = []
    for order in [9, 1, 5]:
        wallet = Account.create()
        sign_in(wallet)
        addresses.append(wallet.address.lower())
        assert (
            client.put(
                f"/api/admin/members/{wallet.address}",
                headers=admin_auth,
                json={"title": "分页排序测试", "introduction": "100% 开源", "sort_order": order},
            ).status_code
            == 200
        )
    first = client.get("/api/members?q=分页排序测试&limit=1").json()
    second = client.get("/api/members?q=分页排序测试&limit=1&offset=1").json()
    assert first["total"] == second["total"] == 3
    assert first["items"][0]["user"]["address"] == addresses[1]
    assert second["items"][0]["user"]["address"] == addresses[2]
    assert client.get("/api/members?q=100%25").json()["total"] == 3
    assert client.get("/api/members?q=unmatched%25").json()["total"] == 0


def test_wall_follows_profile_but_keeps_curated_introduction(client, admin_auth, auth):
    address = client.get("/api/auth/me", headers=auth).json()["address"]
    client.put(
        f"/api/admin/members/{address}",
        headers=admin_auth,
        json={"title": "名片同步测试", "introduction": "管理员精选介绍"},
    )
    client.patch(
        "/api/users/me", headers=auth, json={"nickname": "更新后的昵称", "bio": "个人简介"}
    )
    result = client.get("/api/members?q=名片同步测试").json()["items"][0]
    assert result["user"]["nickname"] == "更新后的昵称"
    assert result["user"]["bio"] == "个人简介"
    assert result["introduction"] == "管理员精选介绍"


def test_existing_database_remains_compatible(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(
            text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY, address VARCHAR(42) UNIQUE NOT NULL,
                nickname VARCHAR(32) NOT NULL, bio TEXT NOT NULL, avatar_url VARCHAR(255),
                created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
            )
        """)
        )
        connection.execute(
            text("""
            INSERT INTO users VALUES
            (1, '0x1111111111111111111111111111111111111111', '原有成员', '', NULL,
             '2026-01-01 00:00:00', '2026-01-01 00:00:00')
        """)
        )
    original_columns = [str(column) for column in inspect(engine).get_columns("users")]
    Base.metadata.create_all(engine)
    Base.metadata.create_all(engine)
    assert [str(column) for column in inspect(engine).get_columns("users")] == original_columns
    with Session(engine) as db:
        user = db.scalar(select(User))
        assert user.nickname == "原有成员"
        assert not user.is_banned
        user.featured = FeaturedMember(title="原有校友", cohort="", introduction="", sort_order=0)
        db.commit()
        assert user.featured.title == "原有校友"
    engine.dispose()
