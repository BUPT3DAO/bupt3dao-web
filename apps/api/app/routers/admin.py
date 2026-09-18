"""所有管理操作都经过实时钱包白名单与封禁状态校验。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import FeaturedMember, Post, User, UserModeration
from app.schemas import (
    AdminUserListOut,
    AdminUserOut,
    BanUpdate,
    MemberOut,
    MemberUpdate,
    PostListOut,
    PostOut,
)
from app.security import get_admin
from app.siwe import SiweError, normalize_address

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_admin)])


def find_user(db: Session, address: str) -> User:
    try:
        address = normalize_address(address)
    except SiweError as exc:
        raise HTTPException(400, str(exc)) from exc
    user = db.scalar(select(User).where(User.address == address))
    if user is None:
        raise HTTPException(404, "用户尚未注册，请先邀请对方通过钱包登录")
    return user


def user_out(user: User, count: int = 0) -> AdminUserOut:
    return AdminUserOut(
        address=user.address,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
        is_admin=user.is_admin,
        is_banned=user.is_banned,
        ban_reason=user.moderation.reason if user.moderation else "",
        post_count=count,
        featured=MemberOut.model_validate(user.featured) if user.featured else None,
    )


@router.get("/users", response_model=AdminUserListOut)
def list_users(
    q: str = Query("", max_length=100),
    featured_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> AdminUserListOut:
    query = select(User)
    if q.strip():
        query = query.where(
            or_(
                User.nickname.contains(q.strip(), autoescape=True),
                User.address.contains(q.strip().lower(), autoescape=True),
            )
        )
    if featured_only:
        query = query.where(User.featured.has())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(
        query.options(selectinload(User.moderation), selectinload(User.featured))
        .order_by(User.created_at.desc(), User.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    counts = dict(
        db.execute(
            select(Post.author_id, func.count())
            .where(Post.author_id.in_([user.id for user in users]))
            .group_by(Post.author_id)
        ).all()
    )
    return AdminUserListOut(
        items=[user_out(user, counts.get(user.id, 0)) for user in users], total=total
    )


@router.patch("/users/{address}/ban", response_model=AdminUserOut)
def ban_user(address: str, payload: BanUpdate, db: Session = Depends(get_db)) -> AdminUserOut:
    user = find_user(db, address)
    if user.is_admin:
        raise HTTPException(403, "不能封禁管理员账号；管理员授权由服务器配置维护")
    if user.moderation is None:
        user.moderation = UserModeration()
    user.moderation.is_banned = payload.is_banned
    user.moderation.reason = payload.reason if payload.is_banned else ""
    db.commit()
    return user_out(user)


@router.get("/posts", response_model=PostListOut)
def list_posts(
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PostListOut:
    query = select(Post).join(User)
    if q.strip():
        query = query.where(
            or_(
                Post.content.contains(q.strip(), autoescape=True),
                User.nickname.contains(q.strip(), autoescape=True),
                User.address.contains(q.strip().lower(), autoescape=True),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    posts = db.scalars(
        query.options(selectinload(Post.author))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return PostListOut(items=[PostOut.model_validate(post) for post in posts], total=total)


@router.put("/members/{address}", response_model=MemberOut)
def feature_member(
    address: str,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
) -> MemberOut:
    user = find_user(db, address)
    if user.is_banned:
        raise HTTPException(409, "请先解封用户，再编辑校友墙展示")
    if user.featured is None:
        user.featured = FeaturedMember()
    for key, value in payload.model_dump().items():
        setattr(user.featured, key, value)
    db.commit()
    return MemberOut.model_validate(user.featured)


@router.delete("/members/{address}", status_code=204)
def unfeature_member(address: str, db: Session = Depends(get_db)) -> None:
    user = find_user(db, address)
    if user.featured is not None:
        db.delete(user.featured)
        db.commit()
