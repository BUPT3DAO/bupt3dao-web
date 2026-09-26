from pathlib import Path

from eth_utils import is_address
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """通过环境变量或 .env 覆盖，变量名与字段名一致。"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "BUPT3DAO API"
    environment: str = "local"
    cors_origins: list[str] = ["http://localhost:3000"]

    # 数据库：默认 SQLite，可换成 postgresql+psycopg://user:pass@host/db
    database_url: str = "sqlite:///./data/app.db"

    # 钱包登录（SIWE / EIP-4361）
    siwe_domain: str = "localhost:3000"
    siwe_uri: str = "http://localhost:3000"
    siwe_statement: str = "登录 BUPT3DAO 社区"
    siwe_chain_id: int = 1
    nonce_ttl_seconds: int = 300

    # 登录态 JWT
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    # 仅由部署配置授权，普通用户不能通过编辑资料获得权限。
    admin_addresses: list[str] = []

    @field_validator("admin_addresses")
    @classmethod
    def validate_admin_addresses(cls, values: list[str]) -> list[str]:
        if any(not is_address(address) for address in values):
            raise ValueError("ADMIN_ADDRESSES 必须是有效的钱包地址列表")
        return list(dict.fromkeys(address.lower() for address in values))

    @model_validator(mode="after")
    def validate_jwt_secret_for_environment(self) -> "Settings":
        if self.environment.strip().lower() not in {"local", "development", "dev", "test"}:
            if len(self.jwt_secret.strip()) < 32:
                raise ValueError(
                    "非本地环境的 JWT_SECRET 至少需要 32 个非空白字符；"
                    "可用 `openssl rand -hex 32` 生成"
                )
        return self

    # 图片上传：头像 2MB；主页背景图与 markdown 内嵌图片 4MB
    upload_dir: Path = Path("./data/uploads")
    max_avatar_bytes: int = 2 * 1024 * 1024
    max_image_bytes: int = 4 * 1024 * 1024


settings = Settings()
