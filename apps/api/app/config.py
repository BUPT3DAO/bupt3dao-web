from pathlib import Path

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

    # 头像上传
    upload_dir: Path = Path("./data/uploads")
    max_avatar_bytes: int = 2 * 1024 * 1024


settings = Settings()
