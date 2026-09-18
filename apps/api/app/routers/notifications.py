"""站内消息：有人回复你的帖子或评论时的提醒。"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Notification, User, UserModeration
from app.routers.articles import excerpt_of
from app.schemas import NotificationListOut, NotificationOut, NotificationSummaryOut, UserBrief
from app.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

# 被封禁用户的动作不再提醒任何人；与帖子、评论的可见性规则保持一致
VISIBLE = ~Notification.actor.has(User.moderation.has(UserModeration.is_banned.is_(True)))


def unread_count(db: Session, user_id: int) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
                VISIBLE,
            )
        )
        or 0
    )


def to_out(notification: Notification) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        kind=notification.kind,
        is_read=notification.is_read,
        created_at=notification.created_at,
        post_id=notification.post_id,
        post_title=notification.post.title,
        comment_id=notification.comment_id,
        excerpt=excerpt_of(notification.comment.content),
        actor=UserBrief.model_validate(notification.actor),
    )


@router.get("", response_model=NotificationListOut)
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationListOut:
    owned = select(Notification).where(Notification.user_id == user.id, VISIBLE)
    total = db.scalar(select(func.count()).select_from(owned.subquery())) or 0
    rows = db.scalars(
        owned.options(
            selectinload(Notification.actor),
            selectinload(Notification.post),
            selectinload(Notification.comment),
        )
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return NotificationListOut(
        items=[to_out(row) for row in rows],
        total=total,
        unread=unread_count(db, user.id),
    )


@router.get("/summary", response_model=NotificationSummaryOut)
def summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationSummaryOut:
    """侧边栏角标只关心未读数，不必拉整个列表。"""
    return NotificationSummaryOut(unread=unread_count(db, user.id))


@router.post("/{notification_id}/read", response_model=NotificationSummaryOut)
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationSummaryOut:
    notification = db.get(Notification, notification_id)
    # 别人的消息一律当作不存在，不泄露 id 是否有效
    if notification is None or notification.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "消息不存在")
    if not notification.is_read:
        notification.is_read = True
        db.commit()
    return NotificationSummaryOut(unread=unread_count(db, user.id))
