"""公开校友墙只展示管理员精选且未被封禁的已注册成员。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import FeaturedMember, User, UserModeration
from app.schemas import MemberListOut, MemberOut

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=MemberListOut)
def list_members(
    q: str = Query("", max_length=100),
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> MemberListOut:
    query = (
        select(FeaturedMember)
        .join(User)
        .where(~User.moderation.has(UserModeration.is_banned.is_(True)))
    )
    if q.strip():
        query = query.where(
            or_(
                User.nickname.contains(q.strip(), autoescape=True),
                FeaturedMember.title.contains(q.strip(), autoescape=True),
                FeaturedMember.cohort.contains(q.strip(), autoescape=True),
                FeaturedMember.introduction.contains(q.strip(), autoescape=True),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    members = db.scalars(
        query.options(selectinload(FeaturedMember.user))
        .order_by(FeaturedMember.sort_order, FeaturedMember.user_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return MemberListOut(items=[MemberOut.model_validate(item) for item in members], total=total)
