"""用户：公开主页、资料编辑、头像上传。"""

import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.models import Post, User
from app.schemas import PostListOut, PostOut, ProfileUpdate, UserProfile, UserPublic
from app.security import get_current_user
from app.siwe import SiweError, normalize_address

router = APIRouter(prefix="/users", tags=["users"])

_ALLOWED_AVATAR_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _count_posts(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Post).where(Post.author_id == user_id)) or 0


def _to_profile(user: User, post_count: int) -> UserProfile:
    return UserProfile(
        address=user.address,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
        post_count=post_count,
        is_admin=user.is_admin,
    )


def _remove_old_avatar(user: User) -> None:
    """删掉上一张头像文件，避免上传目录无限增长。"""
    if not user.avatar_url:
        return
    filename = Path(user.avatar_url).name
    if not filename:
        return
    try:
        (settings.upload_dir / filename).unlink(missing_ok=True)
    except OSError:
        # 旧文件删不掉不影响本次上传
        pass


@router.patch("/me", response_model=UserPublic)
def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    if payload.nickname is not None:
        user.nickname = payload.nickname
    if payload.bio is not None:
        user.bio = payload.bio
    db.commit()
    return UserPublic.model_validate(user)


@router.post("/me/avatar", response_model=UserPublic)
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    extension = _ALLOWED_AVATAR_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "仅支持 PNG / JPEG / WebP / GIF 格式")

    data = file.file.read(settings.max_avatar_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "头像文件为空")
    if len(data) > settings.max_avatar_bytes:
        limit_mb = settings.max_avatar_bytes // (1024 * 1024)
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"头像不能超过 {limit_mb} MB")

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{user.address}-{int(time.time())}{extension}"
    (settings.upload_dir / filename).write_bytes(data)

    _remove_old_avatar(user)
    user.avatar_url = f"/uploads/{filename}"
    db.commit()
    return UserPublic.model_validate(user)


@router.get("/{address}", response_model=UserProfile)
def get_user(address: str, db: Session = Depends(get_db)) -> UserProfile:
    try:
        normalized = normalize_address(address)
    except SiweError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    user = db.scalar(select(User).where(User.address == normalized))
    if user is None or user.is_banned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "该用户还没有加入社区")

    return _to_profile(user, _count_posts(db, user.id))


@router.get("/{address}/posts", response_model=PostListOut)
def list_user_posts(
    address: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PostListOut:
    try:
        normalized = normalize_address(address)
    except SiweError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    user = db.scalar(select(User).where(User.address == normalized))
    if user is None or user.is_banned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "该用户还没有加入社区")

    total = _count_posts(db, user.id)
    posts = db.scalars(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.author_id == user.id)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return PostListOut(items=[PostOut.model_validate(post) for post in posts], total=total)
