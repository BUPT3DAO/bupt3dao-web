"""Game config never exposes private site state to anonymous or banned accounts."""

import pytest
from eth_account.signers.local import LocalAccount
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select

from app.config import Settings, settings
from app.db import SessionLocal
from app.models import User, UserModeration


def test_game_config_requires_active_member(
    client: TestClient, sign_in, wallet: LocalAccount
) -> None:
    status_response = client.get("/api/game/status")
    assert status_response.status_code == 200
    assert status_response.json() == {"enabled": False}
    assert status_response.headers["cache-control"] == "no-store"
    assert client.get("/api/game/config").status_code == 401
    headers = sign_in(wallet)
    response = client.get("/api/game/config", headers=headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, no-store"
    assert response.json()["enabled"] is False
    assert response.json()["contract_address"] is None
    assert response.json()["chain_id"] == 84532

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.address == wallet.address.lower()))
        assert user is not None
        db.add(UserModeration(user_id=user.id, is_banned=True))
        db.commit()
    assert client.get("/api/game/config", headers=headers).status_code == 403


def test_game_config_only_returns_valid_enabled_address(
    client: TestClient, auth, monkeypatch
) -> None:
    address = "0x000000000000000000000000000000000000dEaD"
    monkeypatch.setattr(settings, "game_enabled", True)
    monkeypatch.setattr(settings, "game_contract_address", address)
    response = client.get("/api/game/config", headers=auth)
    assert response.status_code == 200
    assert response.json()["contract_address"] == address
    assert client.get("/api/game/status").json() == {"enabled": True}


def test_sepolia_sign_in_and_unsupported_chain(client: TestClient, wallet: LocalAccount) -> None:
    from eth_account import Account
    from eth_account.messages import encode_defunct

    assert (
        client.post(
            "/api/auth/nonce", json={"address": wallet.address, "chain_id": 999}
        ).status_code
        == 400
    )
    challenge = client.post("/api/auth/nonce", json={"address": wallet.address, "chain_id": 84532})
    assert challenge.status_code == 200
    message = challenge.json()["message"]
    assert "Chain ID: 84532" in message
    signature = Account.sign_message(encode_defunct(text=message), wallet.key).signature.hex()
    accepted = client.post("/api/auth/verify", json={"message": message, "signature": signature})
    assert accepted.status_code == 200


def test_production_game_requires_base_sepolia_https_and_address() -> None:
    options = {
        "_env_file": None,
        "environment": "production",
        "jwt_secret": "x" * 32,
        "game_enabled": True,
    }
    with pytest.raises(ValidationError):
        Settings(**options)
    with pytest.raises(ValidationError):
        Settings(
            **options,
            game_contract_address="0x000000000000000000000000000000000000dEaD",
            game_chain_id=31337,
        )
    with pytest.raises(ValidationError):
        Settings(
            **options,
            game_contract_address="0x000000000000000000000000000000000000dEaD",
            game_rpc_url="http://localhost:8545",
        )
