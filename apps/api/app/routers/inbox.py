"""Combined, private feed for community and event notifications."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import String, cast, func, literal, select, union_all
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Comment, Event, EventNotification, Notification, Post, User, UserModeration
from app.routers.notifications import VISIBLE
from app.schemas import InboxListOut, InboxSummaryOut
from app.security import get_current_user

router = APIRouter(prefix="/inbox", tags=["inbox"])


def _rows(db: Session, user: User, category: str):
    community = (
        select(
            literal("community").label("source"),
            Notification.id.label("id"),
            Notification.kind.label("kind"),
            Notification.is_read.label("is_read"),
            Notification.created_at.label("created_at"),
            Post.title.label("title"),
            func.substr(Comment.content, 1, 240).label("message"),
            (
                literal("/forum/")
                + cast(Notification.post_id, String)
                + literal("#comment-")
                + cast(Notification.comment_id, String)
            ).label("href"),
            literal(False).label("is_stale"),
            literal(False).label("is_hidden"),
        )
        .join(Post, Post.id == Notification.post_id)
        .join(Comment, Comment.id == Notification.comment_id)
        .where(Notification.user_id == user.id, VISIBLE)
    )
    events = (
        select(
            literal("event").label("source"),
            EventNotification.id.label("id"),
            EventNotification.kind.label("kind"),
            EventNotification.is_read.label("is_read"),
            EventNotification.created_at.label("created_at"),
            Event.title.label("title"),
            EventNotification.message.label("message"),
            (literal("/events/") + cast(EventNotification.event_id, String)).label("href"),
            EventNotification.is_stale.label("is_stale"),
            (Event.publication_status == "draft").label("is_hidden"),
        )
        .join(Event, Event.id == EventNotification.event_id)
        .join(User, User.id == EventNotification.user_id)
        .where(
            EventNotification.user_id == user.id,
            ~User.moderation.has(UserModeration.is_banned.is_(True)),
        )
    )
    if category == "community":
        return community
    if category == "event":
        return events
    return union_all(community, events)


def _inbox_item(row) -> dict[str, object]:
    withdrawn = row.source == "event" and row.is_hidden
    return {
        "source": row.source,
        "id": row.id,
        "kind": row.kind,
        "is_read": row.is_read,
        "created_at": row.created_at,
        "title": "活动已撤回" if withdrawn else row.title,
        "message": "活动已撤回，详情暂不可见。" if withdrawn else row.message,
        "href": "/events" if withdrawn else row.href,
        "is_stale": row.is_stale,
    }


def _unread(db: Session, user: User) -> int:
    community_count = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.is_read.is_(False),
                VISIBLE,
            )
        )
        or 0
    )
    event_count = (
        db.scalar(
            select(func.count())
            .select_from(EventNotification)
            .join(User, User.id == EventNotification.user_id)
            .where(
                EventNotification.user_id == user.id,
                EventNotification.is_read.is_(False),
                EventNotification.is_stale.is_(False),
                ~User.moderation.has(UserModeration.is_banned.is_(True)),
            )
        )
        or 0
    )
    return community_count + event_count


@router.get("", response_model=InboxListOut)
def list_inbox(
    response: Response,
    category: str = Query("all", pattern="^(all|community|event)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InboxListOut:
    response.headers["Cache-Control"] = "private, no-store"
    query = _rows(db, user, category).subquery()
    total = db.scalar(select(func.count()).select_from(query)) or 0
    rows = db.execute(
        select(query)
        .order_by(query.c.created_at.desc(), query.c.source.asc(), query.c.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return InboxListOut(
        items=[_inbox_item(row) for row in rows], total=total, unread=_unread(db, user)
    )


@router.get("/summary", response_model=InboxSummaryOut)
def inbox_summary(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InboxSummaryOut:
    response.headers["Cache-Control"] = "private, no-store"
    return InboxSummaryOut(unread=_unread(db, user))


@router.post("/{source}/{notification_id}/read", response_model=InboxSummaryOut)
def mark_inbox_read(
    source: str,
    notification_id: int,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InboxSummaryOut:
    response.headers["Cache-Control"] = "private, no-store"
    if source == "event":
        row = db.get(EventNotification, notification_id)
    elif source == "community":
        row = db.get(Notification, notification_id)
    else:
        raise HTTPException(404, "消息不存在")
    if row is None or row.user_id != user.id:
        raise HTTPException(404, "消息不存在")
    if not row.is_read:
        row.is_read = True
        db.commit()
    return InboxSummaryOut(unread=_unread(db, user))
