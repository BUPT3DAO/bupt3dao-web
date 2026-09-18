from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """通过环境变量或 .env 覆盖，变量名与字段名一致。"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "BUPT3DAO API"
    environment: str = "local"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
