"""个人资料扩展字段与文章墙的权限、排序边界。"""

import pytest
from eth_account import Account

from app.config import settings


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def test_profile_details_round_trip(client, auth):
    payload = {
        "cohort": "2023",
        "school": "计算机学院",
        "major": "计算机科学与技术",
        "university": "北京邮电大学",
        "links": [
            {"label": "X", "url": "https://x.com/BUPT3DAO"},
            {"label": "", "url": "https://example.com/project"},
        ],
    }
    response = client.patch("/api/users/me", headers=auth, json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cohort"] == "2023"
    assert body["school"] == "计算机学院"
    assert body["major"] == "计算机科学与技术"
    assert body["university"] == "北京邮电大学"
    assert [link["url"] for link in body["links"]] == [
        "https://x.com/BUPT3DAO",
        "https://example.com/project",
    ]

    address = body["address"]
    public = client.get(f"/api/users/{address}").json()
    assert public["cohort"] == "2023"
    assert public["major"] == "计算机科学与技术"
    assert public["university"] == "北京邮电大学"
    assert len(public["links"]) == 2

    # 只改昵称不应丢掉已填写的扩展资料
    client.patch("/api/users/me", headers=auth, json={"nickname": "改个名字"})
    after = client.get(f"/api/users/{address}").json()
    assert after["nickname"] == "改个名字"
    assert after["school"] == "计算机学院"
    assert len(after["links"]) == 2

    # 空数组表示清空链接
    assert client.patch("/api/users/me", headers=auth, json={"links": []}).json()["links"] == []


def test_profile_details_validation(client, auth):
    assert client.patch("/api/users/me", headers=auth, json={"cohort": "23"}).status_code == 422
    assert client.patch("/api/users/me", headers=auth, json={"cohort": "abcd"}).status_code == 422
    assert client.patch("/api/users/me", headers=auth, json={"cohort": ""}).status_code == 200
    links = [{"label": "", "url": f"https://example.com/{n}"} for n in range(6)]
    assert client.patch("/api/users/me", headers=auth, json={"links": links}).status_code == 422
    assert (
        client.patch(
            "/api/users/me",
            headers=auth,
            json={"links": [{"label": "危险", "url": "javascript:alert(1)"}]},
        ).status_code
        == 422
    )
    assert (
        client.patch(
            "/api/users/me",
            headers=auth,
            json={"links": [{"label": "无协议", "url": "example.com"}]},
        ).status_code
        == 422
    )
    assert client.patch("/api/users/me", headers=auth, json={"bio": "x" * 2001}).status_code == 422


def test_member_can_publish_and_others_cannot_edit(client, auth, sign_in):
    created = client.post(
        "/api/articles",
        headers=auth,
        json={
            "title": "第一篇",
            "content": "# 标题\n\n正文**强调**内容\n\n- 列表项\n\n[外链](https://example.com)",
        },
    )
    assert created.status_code == 201, created.text
    article_id = created.json()["id"]
    assert created.json()["is_pinned"] is False

    summary = client.get("/api/articles").json()["items"][0]
    assert summary["title"] == "第一篇"
    assert summary["excerpt"] == "标题 正文强调内容 列表项 外链"

    detail = client.get(f"/api/articles/{article_id}").json()
    assert detail["content"].startswith("# 标题")
    assert detail["author"]["address"] == detail["author"]["address"].lower()

    other = sign_in(Account.create())
    assert (
        client.put(
            f"/api/articles/{article_id}", headers=other, json={"title": "改", "content": "改"}
        ).status_code
        == 403
    )
    assert client.delete(f"/api/articles/{article_id}", headers=other).status_code == 403
    assert (
        client.put(
            f"/api/articles/{article_id}", headers=auth, json={"title": "改", "content": "改"}
        ).json()["title"]
        == "改"
    )
    assert client.delete(f"/api/articles/{article_id}", headers=auth).status_code == 204
    assert client.get(f"/api/articles/{article_id}").status_code == 404


def test_article_requires_login_and_valid_payload(client, auth):
    assert client.get("/api/articles").status_code == 200
    assert (
        client.post("/api/articles", json={"title": "未登录", "content": "正文"}).status_code == 401
    )
    assert (
        client.post("/api/articles", headers=auth, json={"title": "  ", "content": "x"}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/articles", headers=auth, json={"title": "缺正文", "content": ""}
        ).status_code
        == 422
    )


def test_admin_pins_reorders_and_deletes_articles(client, auth, admin_auth):
    first = client.post(
        "/api/articles", headers=auth, json={"title": "置顶一", "content": "正文一"}
    ).json()
    second = client.post(
        "/api/articles", headers=auth, json={"title": "置顶二", "content": "正文二"}
    ).json()
    third = client.post(
        "/api/articles", headers=auth, json={"title": "普通文章", "content": "正文三"}
    ).json()

    assert client.get("/api/articles").json()["items"][0]["id"] == third["id"]

    client.patch(
        f"/api/admin/articles/{first['id']}/pin", headers=admin_auth, json={"is_pinned": True}
    )
    client.patch(
        f"/api/admin/articles/{second['id']}/pin", headers=admin_auth, json={"is_pinned": True}
    )
    ordered = [item["id"] for item in client.get("/api/articles").json()["items"]]
    assert ordered == [first["id"], second["id"], third["id"]]

    # 第二条上移到第一位
    assert (
        client.post(
            f"/api/admin/articles/{second['id']}/move",
            headers=admin_auth,
            json={"direction": "up"},
        ).status_code
        == 204
    )
    assert [item["id"] for item in client.get("/api/articles").json()["items"]] == [
        second["id"],
        first["id"],
        third["id"],
    ]
    # 已经在最前，再上移不报错也不改变顺序
    client.post(
        f"/api/admin/articles/{second['id']}/move", headers=admin_auth, json={"direction": "up"}
    )
    assert [item["id"] for item in client.get("/api/articles").json()["items"]] == [
        second["id"],
        first["id"],
        third["id"],
    ]

    client.patch(
        f"/api/admin/articles/{first['id']}/pin", headers=admin_auth, json={"is_pinned": False}
    )
    assert [item["id"] for item in client.get("/api/articles").json()["items"]] == [
        second["id"],
        third["id"],
        first["id"],
    ]

    assert (
        client.post(
            f"/api/admin/articles/{third['id']}/move",
            headers=admin_auth,
            json={"direction": "up"},
        ).status_code
        == 409
    )
    assert client.delete(f"/api/articles/{first['id']}", headers=admin_auth).status_code == 204
    assert (
        client.patch(
            "/api/admin/articles/999999/pin", headers=admin_auth, json={"is_pinned": True}
        ).status_code
        == 404
    )


def test_article_admin_endpoints_reject_members(client, auth):
    article = client.post(
        "/api/articles", headers=auth, json={"title": "越权测试", "content": "正文"}
    ).json()
    assert client.get("/api/admin/articles", headers=auth).status_code == 403
    assert (
        client.patch(
            f"/api/admin/articles/{article['id']}/pin", headers=auth, json={"is_pinned": True}
        ).status_code
        == 403
    )
    assert client.get("/api/admin/articles").status_code == 401


def test_banned_author_articles_are_hidden(client, auth, admin_auth, wallet):
    article = client.post(
        "/api/articles", headers=auth, json={"title": "封禁后隐藏", "content": "正文"}
    ).json()
    assert client.get(f"/api/articles/{article['id']}").status_code == 200

    client.patch(
        f"/api/admin/users/{wallet.address.lower()}/ban",
        headers=admin_auth,
        json={"is_banned": True},
    )
    assert client.get(f"/api/articles/{article['id']}").status_code == 404
    assert all(
        item["id"] != article["id"]
        for item in client.get("/api/articles?limit=100").json()["items"]
    )
    # 管理端仍然能看到，便于清理
    assert any(
        item["id"] == article["id"]
        for item in client.get("/api/admin/articles?limit=100", headers=admin_auth).json()["items"]
    )
    assert client.delete(f"/api/articles/{article['id']}", headers=admin_auth).status_code == 204
