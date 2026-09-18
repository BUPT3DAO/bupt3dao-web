"""登录态签发与鉴权依赖。"""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(address: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": address,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """从 Bearer token 解析出当前用户，未登录或已失效一律 401。"""
    if credentials is None:
        raise _unauthorized("请先连接钱包登录")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized("登录状态已失效，请重新连接钱包") from exc

    address = str(payload.get("sub") or "").lower()
    user = db.scalar(select(User).where(User.address == address))
    if user is None:
        raise _unauthorized("账号不存在，请重新连接钱包")
    return user
