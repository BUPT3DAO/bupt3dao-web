import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_requires_a_long_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET 至少需要 32"):
        Settings(environment="production", jwt_secret="change-me-to-a-random-secret")


def test_production_accepts_a_long_jwt_secret():
    secret = "4c91d8a72f6e0b35" * 2
    config = Settings(environment="production", jwt_secret=secret)

    assert config.jwt_secret == secret


def test_local_development_can_use_short_test_secrets():
    config = Settings(environment="local", jwt_secret="test-only-secret")

    assert config.jwt_secret == "test-only-secret"
