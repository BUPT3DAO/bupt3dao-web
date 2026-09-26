from concurrent.futures import ThreadPoolExecutor

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_account.signers.local import LocalAccount
from fastapi.testclient import TestClient

from app.config import settings
from app.db import SessionLocal
from app.siwe import NonceStore


def test_nonce_returns_eip4361_message(client: TestClient, wallet: LocalAccount) -> None:
    response = client.post("/api/auth/nonce", json={"address": wallet.address})

    assert response.status_code == 200
    body = response.json()
    assert body["nonce"] in body["message"]
    assert "wants you to sign in with your Ethereum account" in body["message"]
    assert "localhost:3000" in body["message"]


def test_nonce_rejects_invalid_address(client: TestClient) -> None:
    response = client.post("/api/auth/nonce", json={"address": "not-an-address"})

    assert response.status_code == 400


def test_sign_in_then_read_me(client: TestClient, sign_in, wallet: LocalAccount) -> None:
    headers = sign_in(wallet)

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["address"] == wallet.address.lower()
    assert me.json()["nickname"] == ""


def test_me_requires_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer bad"}).status_code == 401


def test_nonce_cannot_be_replayed(client: TestClient, wallet: LocalAccount) -> None:
    challenge = client.post("/api/auth/nonce", json={"address": wallet.address}).json()
    signature = Account.sign_message(
        encode_defunct(text=challenge["message"]), wallet.key
    ).signature.hex()
    payload = {"message": challenge["message"], "signature": signature}

    assert client.post("/api/auth/verify", json=payload).status_code == 200
    # nonce 一次性，重放同一份签名必须失败
    assert client.post("/api/auth/verify", json=payload).status_code == 401


def test_signature_from_another_wallet_is_rejected(
    client: TestClient, wallet: LocalAccount
) -> None:
    intruder = Account.create()
    challenge = client.post("/api/auth/nonce", json={"address": wallet.address}).json()
    forged = Account.sign_message(
        encode_defunct(text=challenge["message"]), intruder.key
    ).signature.hex()

    response = client.post(
        "/api/auth/verify", json={"message": challenge["message"], "signature": forged}
    )

    assert response.status_code == 401


def test_invalid_signature_does_not_consume_nonce(client: TestClient, wallet: LocalAccount) -> None:
    challenge = client.post("/api/auth/nonce", json={"address": wallet.address}).json()
    forged = Account.sign_message(
        encode_defunct(text=challenge["message"]), Account.create().key
    ).signature.hex()

    rejected = client.post(
        "/api/auth/verify", json={"message": challenge["message"], "signature": forged}
    )
    signature = Account.sign_message(
        encode_defunct(text=challenge["message"]), wallet.key
    ).signature.hex()
    accepted = client.post(
        "/api/auth/verify", json={"message": challenge["message"], "signature": signature}
    )

    assert rejected.status_code == 401
    assert accepted.status_code == 200


def test_siwe_rejects_uri_chain_and_missing_expiration(
    client: TestClient, wallet: LocalAccount
) -> None:
    challenge = client.post("/api/auth/nonce", json={"address": wallet.address}).json()
    valid_message = challenge["message"]
    mutations = [
        valid_message.replace(f"URI: {settings.siwe_uri}", "URI: https://attacker.example"),
        valid_message.replace(f"Chain ID: {settings.siwe_chain_id}", "Chain ID: 999"),
        "\n".join(
            line for line in valid_message.splitlines() if not line.startswith("Expiration Time:")
        ),
    ]

    for message in mutations:
        signature = Account.sign_message(encode_defunct(text=message), wallet.key).signature.hex()
        response = client.post(
            "/api/auth/verify", json={"message": message, "signature": signature}
        )
        assert response.status_code == 401


def test_nonce_store_atomically_consumes_once() -> None:
    store = NonceStore(ttl_seconds=30)
    with SessionLocal() as db:
        nonce = store.issue(db, "0xabc")

    with SessionLocal() as db:
        assert store.peek(db, "0xabc") == nonce
        assert store.consume_if_matches(db, "0xabc", "wrong") is False
        assert store.consume_if_matches(db, "0xabc", nonce) is True
        assert store.consume_if_matches(db, "0xabc", nonce) is False
        assert store.peek(db, "0xabc") is None


def test_nonce_store_allows_only_one_concurrent_consumer() -> None:
    store = NonceStore(ttl_seconds=30)
    with SessionLocal() as db:
        nonce = store.issue(db, "0xdef")

    def consume_once(_: int) -> bool:
        with SessionLocal() as db:
            return store.consume_if_matches(db, "0xdef", nonce)

    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(consume_once, range(48)))

    assert results.count(True) == 1


def test_nonce_store_is_shared_between_database_sessions() -> None:
    store = NonceStore(ttl_seconds=30)
    with SessionLocal() as issuer:
        nonce = store.issue(issuer, "0x123")
    with SessionLocal() as verifier:
        assert store.peek(verifier, "0x123") == nonce
        assert store.consume_if_matches(verifier, "0x123", nonce) is True
    with SessionLocal() as another_instance:
        assert store.peek(another_instance, "0x123") is None


def test_nonce_store_rejects_expired_challenge() -> None:
    store = NonceStore(ttl_seconds=-1)
    with SessionLocal() as db:
        nonce = store.issue(db, "0x456")
        assert store.peek(db, "0x456") is None
        assert store.consume_if_matches(db, "0x456", nonce) is False


def test_verify_request_rejects_oversized_fields(client: TestClient) -> None:
    response = client.post("/api/auth/verify", json={"message": "x" * 2049, "signature": "x"})

    assert response.status_code == 422
