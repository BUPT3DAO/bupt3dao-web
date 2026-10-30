"""社区抽奖：管理员配置、成员不限次数抽奖、记录与发放。"""

import pytest
from eth_account import Account
from fastapi.testclient import TestClient

from app.config import settings
from app.routers import lottery


@pytest.fixture
def admin_auth(monkeypatch, sign_in):
    wallet = Account.create()
    monkeypatch.setattr(settings, "admin_addresses", [wallet.address.lower()])
    return sign_in(wallet)


def _fresh_round(client: TestClient, admin: dict[str, str], is_open: bool = True) -> dict:
    """测试共用一个库：每个用例都在新的一轮里进行，并清空沿用过来的选项。"""
    payload = {"title": "招新抽奖", "description": "", "is_open": False}
    assert client.put("/api/admin/lottery", json=payload, headers=admin).status_code == 200
    data = client.post("/api/admin/lottery/rounds", headers=admin).json()
    for prize in data["campaign"]["prizes"]:
        client.delete(f"/api/admin/lottery/prizes/{prize['id']}", headers=admin)
    payload["is_open"] = is_open
    return client.put("/api/admin/lottery", json=payload, headers=admin).json()


def _add_prize(client: TestClient, admin: dict[str, str], name: str, weight: int = 1) -> dict:
    response = client.post(
        "/api/admin/lottery/prizes", json={"name": name, "weight": weight}, headers=admin
    )
    assert response.status_code == 201, response.text
    return next(p for p in response.json()["campaign"]["prizes"] if p["name"] == name)


def test_admin_endpoints_require_admin(client: TestClient, auth: dict[str, str]) -> None:
    assert client.get("/api/admin/lottery").status_code == 401
    assert client.get("/api/admin/lottery", headers=auth).status_code == 403
    payload = {"title": "x", "is_open": True}
    assert client.put("/api/admin/lottery", json=payload, headers=auth).status_code == 403


def test_draw_requires_login(client: TestClient) -> None:
    assert client.post("/api/lottery/draw").status_code == 401
    assert client.get("/api/lottery/me").status_code == 401


def test_closed_lottery_rejects_draws(
    client: TestClient, admin_auth: dict[str, str], auth: dict[str, str]
) -> None:
    _fresh_round(client, admin_auth, is_open=False)
    _add_prize(client, admin_auth, "徽章")

    assert client.get("/api/lottery/status").json() == {"open": False}
    response = client.post("/api/lottery/draw", headers=auth)
    assert response.status_code == 409
    assert response.json()["detail"] == "抽奖暂未开放"


def test_draws_are_unlimited(
    client: TestClient, admin_auth: dict[str, str], auth: dict[str, str]
) -> None:
    _fresh_round(client, admin_auth)
    assert client.post("/api/lottery/draw", headers=auth).status_code == 409
    _add_prize(client, admin_auth, "贴纸")

    for _ in range(5):
        response = client.post("/api/lottery/draw", headers=auth)
        assert response.status_code == 200, response.text
        assert response.json()["prize_name"] == "贴纸"

    assert len(client.get("/api/lottery/me", headers=auth).json()["draws"]) == 5
    stats = client.get("/api/admin/lottery", headers=admin_auth).json()
    assert (stats["participants"], stats["total_draws"]) == (1, 5)


def test_weighted_pick_uses_weights(
    client: TestClient, admin_auth: dict[str, str], auth: dict[str, str], monkeypatch
) -> None:
    _fresh_round(client, admin_auth)
    _add_prize(client, admin_auth, "一等奖", weight=1)
    _add_prize(client, admin_auth, "三等奖", weight=3)
    _add_prize(client, admin_auth, "暂停", weight=0)

    prizes = client.get("/api/lottery").json()["campaign"]["prizes"]
    assert {p["name"]: p["chance"] for p in prizes} == {"一等奖": 25.0, "三等奖": 75.0, "暂停": 0}

    seen: list[list[int]] = []

    def fake_choices(population, weights):
        seen.append(list(weights))
        return [population[-1]]

    monkeypatch.setattr(lottery._rng, "choices", fake_choices)
    result = client.post("/api/lottery/draw", headers=auth).json()
    assert seen == [[1, 3]]
    assert result["prize_name"] == "三等奖"


def test_records_and_delivery(
    client: TestClient, admin_auth: dict[str, str], auth: dict[str, str], wallet
) -> None:
    _fresh_round(client, admin_auth)
    prize = _add_prize(client, admin_auth, "帆布袋")
    draw = client.post("/api/lottery/draw", headers=auth).json()

    records = client.get("/api/admin/lottery/records", headers=admin_auth).json()
    assert records["total"] == 1
    assert records["items"][0]["user"]["address"] == wallet.address.lower()
    assert records["items"][0]["delivered"] is False

    marked = client.patch(
        f"/api/admin/lottery/draws/{draw['id']}", json={"delivered": True}, headers=admin_auth
    )
    assert marked.status_code == 200
    assert client.get("/api/lottery/me", headers=auth).json()["draws"][0]["delivered"] is True

    # 删除选项后，记录仍保留抽中时的名字
    client.delete(f"/api/admin/lottery/prizes/{prize['id']}", headers=admin_auth)
    kept = client.get("/api/admin/lottery/records", headers=admin_auth).json()["items"][0]
    assert kept["prize_name"] == "帆布袋"
    assert kept["prize_id"] is None


def test_new_round_keeps_options_and_clears_records(
    client: TestClient, admin_auth: dict[str, str], auth: dict[str, str]
) -> None:
    _fresh_round(client, admin_auth)
    _add_prize(client, admin_auth, "钥匙扣", weight=2)
    assert client.post("/api/lottery/draw", headers=auth).status_code == 200

    new_round = client.post("/api/admin/lottery/rounds", headers=admin_auth).json()
    assert new_round["campaign"]["is_open"] is False
    assert new_round["total_draws"] == 0
    copied = new_round["campaign"]["prizes"][0]
    assert (copied["name"], copied["weight"]) == ("钥匙扣", 2)
    assert client.get("/api/lottery/me", headers=auth).json() == {"draws": []}


def test_prize_limit_and_validation(client: TestClient, admin_auth: dict[str, str]) -> None:
    _fresh_round(client, admin_auth, is_open=False)
    bad = client.post(
        "/api/admin/lottery/prizes", json={"name": "", "weight": -1}, headers=admin_auth
    )
    assert bad.status_code == 422
    for index in range(12):
        _add_prize(client, admin_auth, f"选项{index}")
    over = client.post(
        "/api/admin/lottery/prizes", json={"name": "多余", "weight": 1}, headers=admin_auth
    )
    assert over.status_code == 400
