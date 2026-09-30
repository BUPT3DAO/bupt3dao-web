"""Transactional event notifications and due reminder delivery."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Event, EventChange, EventFollow, EventNotification, User, UserModeration

TRACKED_FIELDS = (
    "starts_at",
    "ends_at",
    "location",
    "registration_url",
    "registration_deadline",
    "materials",
)
FIELD_LABELS = {
    "starts_at": "开始时间",
    "ends_at": "结束时间",
    "location": "地点",
    "registration_url": "报名链接",
    "registration_deadline": "报名截止时间",
    "materials": "活动资料",
}


def notify_followers(
    db: Session,
    event: Event,
    kind: str,
    changed_fields: list[str] | None = None,
) -> int:
    """Add one notification per active, non-banned follower in the caller's transaction."""
    changes = changed_fields or []
    db.add(EventChange(event_id=event.id, kind=kind, changed_fields=changes))
    if kind in {"event_cancelled", "event_withdrawn"} or "starts_at" in changes:
        db.query(EventNotification).filter(
            EventNotification.event_id == event.id,
            EventNotification.kind == "event_reminder",
        ).update(
            {EventNotification.is_stale: True, EventNotification.is_read: True},
            synchronize_session=False,
        )

    followers = db.scalars(
        select(EventFollow.user_id)
        .join(User, User.id == EventFollow.user_id)
        .where(
            EventFollow.event_id == event.id,
            EventFollow.is_active.is_(True),
            ~User.moderation.has(UserModeration.is_banned.is_(True)),
        )
    ).all()
    if kind == "event_changed":
        message = "活动信息已更新：" + "、".join(FIELD_LABELS[field] for field in changes)
    elif kind == "event_cancelled":
        message = f"活动已取消：{event.cancellation_reason}"
    elif kind == "event_withdrawn":
        message = "活动已撤回，详情暂不可见。"
    elif kind == "event_republished":
        message = "活动已重新发布，可以查看最新安排。"
    elif kind == "materials_updated":
        message = "活动资料与复盘已更新。"
    else:
        message = "活动安排已更新。"
    db.add_all(
        EventNotification(
            user_id=user_id,
            event_id=event.id,
            kind=kind,
            message=message,
            changed_fields=changes,
            event_start_snapshot=event.starts_at,
        )
        for user_id in followers
    )
    return len(followers)


def _reminder_offsets(preference: str) -> tuple[int, ...]:
    if preference == "24h_1h":
        return (1, 24)
    if preference == "1h":
        return (1,)
    return ()


def deliver_due_reminders(db: Session, now: datetime | None = None) -> int:
    """Deliver due reminders, deduplicated by recipient/event/start/offset."""
    current = now or datetime.now(timezone.utc)
    candidates = db.execute(
        select(EventFollow, Event)
        .join(Event, Event.id == EventFollow.event_id)
        .join(User, User.id == EventFollow.user_id)
        .where(
            EventFollow.is_active.is_(True),
            Event.publication_status == "published",
            ~User.moderation.has(UserModeration.is_banned.is_(True)),
        )
    ).all()
    sent = 0
    for follow, event in candidates:
        start = event.starts_at
        if start is None:
            continue
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if start <= current:
            continue
        elapsed = start - current
        offsets = _reminder_offsets(follow.reminder_preference)
        due = next(
            (offset for offset in offsets if elapsed <= timedelta(hours=offset)),
            None,
        )
        if due is None:
            continue
        exists = db.scalar(
            select(EventNotification.id).where(
                EventNotification.user_id == follow.user_id,
                EventNotification.event_id == event.id,
                EventNotification.kind == "event_reminder",
                EventNotification.event_start_snapshot == start,
                EventNotification.reminder_offset == due,
            )
        )
        if exists:
            continue
        try:
            with db.begin_nested():
                db.add(
                    EventNotification(
                        user_id=follow.user_id,
                        event_id=event.id,
                        kind="event_reminder",
                        message=f"活動將於{due}小時後開始。",
                        event_start_snapshot=start,
                        reminder_offset=due,
                    )
                )
                db.flush()
            sent += 1
        except IntegrityError:
            # A concurrent worker won the unique-key race after our read.
            continue
    if sent:
        db.commit()
    return sent
