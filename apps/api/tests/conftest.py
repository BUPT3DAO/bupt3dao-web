"""测试夹具：用临时 SQLite 与临时上传目录，不污染本地数据。"""

import os
import tempfile
from collections.abc import Callable
from pathlib import Path

# 必须在导入 app.* 之前设置，配置对象在导入时就会读取环境变量
_TMP_DIR = Path(tempfile.mkdtemp(prefix="bupt3dao-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_TMP_DIR / "uploads")
os.environ["JWT_SECRET"] = "test-only-secret-for-local-signing-tests"
os.environ["SIWE_DOMAIN"] = "localhost:3000"
os.environ["SIWE_URI"] = "http://localhost:3000"
os.environ["ADMIN_ADDRESSES"] = "[]"

import pytest  # noqa: E402
from eth_account import Account  # noqa: E402
from eth_account.messages import encode_defunct  # noqa: E402
from eth_account.signers.local import LocalAccount  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

SignIn = Callable[[LocalAccount], dict[str, str]]


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def sign_in(client: TestClient) -> SignIn:
    """返回「走完整登录流程并拿到鉴权请求头」的辅助函数。"""

    def _sign_in(wallet: LocalAccount) -> dict[str, str]:
        challenge = client.post("/api/auth/nonce", json={"address": wallet.address})
        assert challenge.status_code == 200, challenge.text

        message = challenge.json()["message"]
        signature = Account.sign_message(encode_defunct(text=message), wallet.key).signature.hex()
        response = client.post(
            "/api/auth/verify", json={"message": message, "signature": signature}
        )
        assert response.status_code == 200, response.text

        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _sign_in


@pytest.fixture
def wallet() -> LocalAccount:
    return Account.create()


@pytest.fixture
def auth(sign_in: SignIn, wallet: LocalAccount) -> dict[str, str]:
    return sign_in(wallet)
