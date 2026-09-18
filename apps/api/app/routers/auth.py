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
def issue_nonce(payload: NonceRequest) -> NonceResponse:
    """签发一次性 nonce，同时返回拼好的待签名消息。"""
    try:
        address = normalize_address(payload.address)
    except SiweError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    nonce = nonce_store.issue(address)
    return NonceResponse(nonce=nonce, message=build_message(address, nonce))


@router.post("/verify", response_model=TokenResponse)
def verify_signature(payload: VerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """校验签名；地址首次出现时自动注册。"""
    try:
        address = normalize_address(parse_message(payload.message).address)
        # 先取出 nonce（一次性作废），签名校验失败也不会被重放
        expected_nonce = nonce_store.consume(address)
        verify_message(payload.message, payload.signature, expected_nonce)
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
