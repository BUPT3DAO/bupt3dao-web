"""用户：公开主页、资料编辑、头像与主页背景图上传。"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.models import Post, ProfileDetail, User
from app.routers.posts import count_comments, summary_of
from app.schemas import PostListOut, ProfileUpdate, UploadedImageOut, UserProfile, UserPublic
from app.security import get_current_user
from app.siwe import SiweError, normalize_address
from app.uploads import remove_image, save_image

router = APIRouter(prefix="/users", tags=["users"])


def _count_posts(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Post).where(Post.author_id == user_id)) or 0


def _to_profile(user: User, post_count: int) -> UserProfile:
    return UserProfile(
        address=user.address,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        banner_url=user.banner_url,
        bio=user.bio,
        created_at=user.created_at,
        post_count=post_count,
        is_admin=user.is_admin,
        cohort=user.cohort,
        school=user.school,
        major=user.major,
        university=user.university,
        links=user.links,
    )


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

    # 扩展资料放在独立表里，首次填写时才建行
    details = payload.model_dump(
        exclude_none=True, include={"cohort", "school", "major", "university", "links"}
    )
    if details:
        if user.detail is None:
            user.detail = ProfileDetail()
        for field, value in details.items():
            setattr(user.detail, field, value)
    db.commit()
    return UserPublic.model_validate(user)


@router.post("/me/avatar", response_model=UserPublic)
def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    url = save_image(file, user.address, settings.max_avatar_bytes, "头像")
    previous_url = user.avatar_url
    user.avatar_url = url
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    remove_image(previous_url)
    return UserPublic.model_validate(user)


@router.post("/me/banner", response_model=UserPublic)
def upload_banner(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPublic:
    url = save_image(file, user.address, settings.max_image_bytes, "主页背景图")
    previous_url = user.banner_url
    user.banner_url = url
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    remove_image(previous_url)
    return UserPublic.model_validate(user)


@router.post("/me/images", response_model=UploadedImageOut)
def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> UploadedImageOut:
    """给 markdown 正文里插图片用：先传上来拿到地址，再写进正文。"""
    return UploadedImageOut(url=save_image(file, user.address, settings.max_image_bytes, "图片"))


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
    counts = count_comments(db, [post.id for post in posts])
    return PostListOut(
        items=[summary_of(post, counts.get(post.id, 0)) for post in posts], total=total
    )
