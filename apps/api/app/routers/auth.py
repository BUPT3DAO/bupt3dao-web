"""钱包登录：签发挑战 -> 校验签名 -> 发放登录态。"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import NonceRequest, NonceResponse, TokenResponse, UserPublic, VerifyRequest
from app.security import create_access_token, ensure_active, get_current_user
from app.siwe import (
    SiweError,
    build_message,
    nonce_store,
    normalize_address,
    parse_message,
    verify_message,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/nonce", response_model=NonceResponse)
def issue_nonce(payload: NonceRequest, db: Session = Depends(get_db)) -> NonceResponse:
    """签发一次性 nonce，同时返回拼好的待签名消息。"""
    try:
        address = normalize_address(payload.address)
    except SiweError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    nonce = nonce_store.issue(db, address)
    return NonceResponse(nonce=nonce, message=build_message(address, nonce))


@router.post("/verify", response_model=TokenResponse)
def verify_signature(payload: VerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """校验签名；地址首次出现时自动注册。"""
    try:
        address = normalize_address(parse_message(payload.message).address)
        # 无效签名不应作废公开可见地址对应的登录挑战。
        expected_nonce = nonce_store.peek(db, address)
        verify_message(payload.message, payload.signature, expected_nonce)
        # 比对并作废必须原子完成，避免两份并发请求同时通过同一个 nonce。
        if expected_nonce is None or not nonce_store.consume_if_matches(
            db, address, expected_nonce
        ):
            raise SiweError("登录挑战已使用，请重新签名")
    except SiweError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    user = db.scalar(select(User).where(User.address == address))
    if user is None:
        user = User(address=address)
        db.add(user)
        db.commit()
        db.refresh(user)

    ensure_active(user)
    return TokenResponse(
        access_token=create_access_token(address),
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
def read_me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(user)
