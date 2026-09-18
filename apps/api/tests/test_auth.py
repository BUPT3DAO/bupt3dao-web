from eth_account import Account
from eth_account.messages import encode_defunct
from eth_account.signers.local import LocalAccount
from fastapi.testclient import TestClient


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


def test_failed_verification_does_not_consume_nonce(
    client: TestClient, wallet: LocalAccount
) -> None:
    """签名校验失败不得作废 nonce。

    回归测试：曾经 /verify 在验签前就消费 nonce，导致任何人提交一个伪造签名
    即可让目标地址当前有效的 nonce 失效，目标用户随后用自己的合法签名也无法登录
    （未认证的登录拒绝服务）。
    """
    challenge = client.post("/api/auth/nonce", json={"address": wallet.address}).json()

    # 攻击者：地址是公开信息，签名随便填 —— 这次尝试必须失败，且不能烧掉 nonce
    bad = {"message": challenge["message"], "signature": "0x" + "00" * 65}
    assert client.post("/api/auth/verify", json=bad).status_code == 401

    # 本人随后提交合法签名，仍应成功登录
    signature = Account.sign_message(
        encode_defunct(text=challenge["message"]), wallet.key
    ).signature.hex()
    good = {"message": challenge["message"], "signature": signature}
    assert client.post("/api/auth/verify", json=good).status_code == 200
