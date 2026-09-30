"""社区活动。活动内容仅对已登录且未封禁的社区成员开放。"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.event_service import TRACKED_FIELDS, notify_followers
from app.models import Event, EventChange, EventFollow, EventNotification, User
from app.schemas import (
    EventCancelPayload,
    EventFollowOut,
    EventFollowPayload,
    EventListOut,
    EventOut,
    EventPayload,
)
from app.security import get_admin, get_current_user

router = APIRouter(tags=["events"])
admin_router = APIRouter(
    prefix="/admin/events", tags=["admin-events"], dependencies=[Depends(get_admin)]
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def event_out(
    event: Event, follow: EventFollow | None = None, followers_notified: int = 0
) -> EventOut:
    now = now_utc()
    starts_at = as_utc(event.starts_at)
    ends_at = as_utc(event.ends_at)
    deadline = as_utc(event.registration_deadline)
    if event.publication_status == "draft":
        state = "draft"
    elif event.publication_status == "cancelled":
        state = "cancelled"
    elif ends_at and ends_at < now:
        state = "ended"
    elif starts_at and starts_at <= now:
        state = "ongoing"
    else:
        state = "upcoming"
    registration_open = bool(
        event.publication_status == "published"
        and event.registration_url
        and starts_at
        and now < starts_at
        and (deadline is None or now < deadline)
    )
    return EventOut(
        id=event.id,
        title=event.title,
        summary=event.summary,
        content=event.content,
        organizer=event.organizer,
        location=event.location,
        starts_at=starts_at,
        ends_at=ends_at,
        registration_url=event.registration_url,
        registration_deadline=deadline,
        materials=event.materials,
        publication_status=event.publication_status,
        cancellation_reason=event.cancellation_reason,
        event_state=state,
        registration_open=registration_open,
        followed=bool(follow and follow.is_active),
        reminder_preference=follow.reminder_preference if follow and follow.is_active else None,
        followers_notified=followers_notified,
        created_at=as_utc(event.created_at),
        updated_at=as_utc(event.updated_at),
    )


def event_list_out(
    events: list[Event],
    total: int,
    db: Session | None = None,
    user_id: int | None = None,
    redact_withdrawn: bool = False,
) -> EventListOut:
    follows: dict[int, EventFollow] = {}
    if db and user_id and events:
        follows = {
            follow.event_id: follow
            for follow in db.scalars(
                select(EventFollow).where(
                    EventFollow.user_id == user_id,
                    EventFollow.is_active.is_(True),
                    EventFollow.event_id.in_([event.id for event in events]),
                )
            ).all()
        }
    items = []
    for event in events:
        if redact_withdrawn and event.publication_status == "draft":
            item = event_out(event, follows.get(event.id)).model_copy(
                update={
                    "title": "活动已撤回",
                    "summary": "",
                    "content": "",
                    "organizer": "",
                    "location": "",
                    "starts_at": None,
                    "ends_at": None,
                    "registration_url": None,
                    "registration_deadline": None,
                    "materials": "",
                    "registration_open": False,
                }
            )
        else:
            item = event_out(event, follows.get(event.id))
        items.append(item)
    return EventListOut(items=items, total=total)


def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


def apply_payload(event: Event, payload: EventPayload) -> None:
    for field, value in payload.model_dump().items():
        setattr(event, field, value)


def require_publishable(event: Event) -> None:
    if not all((event.title, event.content, event.organizer, event.location)):
        raise HTTPException(422, "发布前请填写标题、活动介绍、主办方和地点")
    if not event.starts_at or not event.ends_at:
        raise HTTPException(422, "发布前请填写活动开始和结束时间")
    start = as_utc(event.starts_at)
    end = as_utc(event.ends_at)
    deadline = as_utc(event.registration_deadline)
    if end <= start:
        raise HTTPException(422, "活动结束时间必须晚于开始时间")
    if deadline and deadline > start:
        raise HTTPException(422, "报名截止时间不能晚于活动开始时间")
    if event.registration_url and event.registration_deadline is None:
        event.registration_deadline = start


def ics_escape(value: str) -> str:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    return (
        normalized.replace("\\", "\\\\")
        .replace(";", r"\;")
        .replace(",", r"\,")
        .replace("\n", r"\n")
    )


def ics_datetime(value: datetime) -> str:
    normalized = as_utc(value)
    assert normalized is not None
    return normalized.strftime("%Y%m%dT%H%M%SZ")


def fold_ics_line(line: str) -> list[str]:
    """按 iCalendar 75 个 UTF-8 字节限制折行，不拆开多字节字符。"""
    chunks: list[str] = []
    current = ""
    size = 0
    for char in line:
        char_size = len(char.encode("utf-8"))
        if size + char_size > 75:
            chunks.append(current)
            current = " "
            size = 1
        current += char
        size += char_size
    chunks.append(current)
    return chunks


@router.get("/events", response_model=EventListOut)
def list_events(
    response: Response,
    period: str = Query("upcoming", pattern="^(upcoming|past)$"),
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventListOut:
    no_store(response)
    now = now_utc()
    query = select(Event).where(Event.publication_status.in_(("published", "cancelled")))
    if period == "upcoming":
        query = query.where(Event.publication_status == "published", Event.ends_at >= now)
        ordering = (Event.starts_at.asc(), Event.id.asc())
    else:
        query = query.where(or_(Event.publication_status == "cancelled", Event.ends_at < now))
        ordering = (Event.starts_at.desc(), Event.id.desc())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(*ordering).limit(limit).offset(offset)).all()
    return event_list_out(rows, total, db, _user.id)


@router.get("/events/mine", response_model=EventListOut)
def list_my_events(
    response: Response,
    period: str = Query("upcoming", pattern="^(upcoming|past|all)$"),
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventListOut:
    no_store(response)
    now = now_utc()
    query = (
        select(Event)
        .join(EventFollow, EventFollow.event_id == Event.id)
        .where(EventFollow.user_id == user.id, EventFollow.is_active.is_(True))
    )
    if period == "upcoming":
        query = query.where(
            Event.publication_status == "published",
            Event.ends_at >= now,
        )
        ordering = (Event.starts_at.asc(), Event.id.asc())
    elif period == "past":
        query = query.where(or_(Event.publication_status == "cancelled", Event.ends_at < now))
        ordering = (Event.starts_at.desc(), Event.id.desc())
    else:
        ordering = (Event.starts_at.desc(), Event.id.desc())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(*ordering).limit(limit).offset(offset)).all()
    return event_list_out(rows, total, db, user.id, redact_withdrawn=True)


@router.put("/events/{event_id}/follow", response_model=EventFollowOut)
def follow_event(
    event_id: int,
    payload: EventFollowPayload,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventFollowOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None or event.publication_status not in {"published", "cancelled"}:
        raise HTTPException(404, "活动不存在")
    if event.publication_status == "cancelled":
        raise HTTPException(409, "已取消的活动不能新关注")
    follow = db.scalar(
        select(EventFollow).where(EventFollow.user_id == user.id, EventFollow.event_id == event.id)
    )
    was_active = bool(follow and follow.is_active)
    if follow is None:
        follow = EventFollow(user_id=user.id, event_id=event.id)
        db.add(follow)
    follow.is_active = True
    follow.reminder_preference = payload.reminder_preference
    db.flush()
    # Followed within the active reminder window: send the nearest eligible
    # reminder immediately. The unique constraint makes retries idempotent.
    event_start = as_utc(event.starts_at)
    if not was_active and event_start and event_start > now_utc():
        remaining = event_start - now_utc()
        offset = None
        if payload.reminder_preference == "24h_1h":
            offset = (
                1
                if remaining <= timedelta(hours=1)
                else 24
                if remaining <= timedelta(hours=24)
                else None
            )
        elif payload.reminder_preference == "1h" and remaining <= timedelta(hours=1):
            offset = 1
        if offset is not None:
            already_sent = db.scalar(
                select(EventNotification.id).where(
                    EventNotification.user_id == user.id,
                    EventNotification.event_id == event.id,
                    EventNotification.kind == "event_reminder",
                    EventNotification.event_start_snapshot == event_start,
                    EventNotification.reminder_offset == offset,
                )
            )
            if not already_sent:
                db.add(
                    EventNotification(
                        user_id=user.id,
                        event_id=event.id,
                        kind="event_reminder",
                        message=f"活动将于{offset}小时后开始。",
                        event_start_snapshot=event_start,
                        reminder_offset=offset,
                    )
                )
    db.commit()
    return EventFollowOut(followed=True, reminder_preference=follow.reminder_preference)


@router.delete("/events/{event_id}/follow", response_model=EventFollowOut)
def unfollow_event(
    event_id: int,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventFollowOut:
    no_store(response)
    follow = db.scalar(
        select(EventFollow).where(EventFollow.user_id == user.id, EventFollow.event_id == event_id)
    )
    if follow and follow.is_active:
        follow.is_active = False
        db.commit()
    return EventFollowOut(followed=False, reminder_preference="1h")


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(
    event_id: int,
    response: Response,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None or event.publication_status == "draft":
        raise HTTPException(404, "活动不存在")
    follow = db.scalar(
        select(EventFollow).where(
            EventFollow.user_id == _user.id,
            EventFollow.event_id == event.id,
            EventFollow.is_active.is_(True),
        )
    )
    return event_out(event, follow)


@router.get("/events/{event_id}/calendar.ics")
def download_event_calendar(
    event_id: int,
    response: Response,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None or event.publication_status != "published":
        raise HTTPException(404, "活动日历不存在")
    require_publishable(event)
    host = "bupt3dao.club"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//BUPT3DAO//Community Events//ZH",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:event-{event.id}@{host}",
        f"DTSTAMP:{ics_datetime(event.updated_at)}",
        f"DTSTART:{ics_datetime(event.starts_at)}",
        f"DTEND:{ics_datetime(event.ends_at)}",
        f"SUMMARY:{ics_escape(event.title)}",
        f"DESCRIPTION:{ics_escape(event.summary or event.content[:500])}",
        f"LOCATION:{ics_escape(event.location)}",
        f"URL:https://{host}/events/{event.id}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ]
    return PlainTextResponse(
        "\r\n".join(part for line in lines for part in fold_ics_line(line)),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f"attachment; filename=bupt3dao-event-{event.id}.ics",
        },
    )


@admin_router.get("", response_model=EventListOut)
def admin_list_events(
    response: Response,
    q: str = Query("", max_length=100),
    limit: int = Query(12, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> EventListOut:
    no_store(response)
    query = select(Event)
    if q.strip():
        query = query.where(Event.title.contains(q.strip(), autoescape=True))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Event.created_at.desc(), Event.id.desc()).limit(limit).offset(offset)
    ).all()
    return event_list_out(rows, total)


@admin_router.get("/{event_id}", response_model=EventOut)
def admin_get_event(
    event_id: int,
    response: Response,
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "活动不存在")
    return event_out(event)


@admin_router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventPayload,
    response: Response,
    _user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = Event()
    apply_payload(event, payload)
    event.publication_status = "draft"
    db.add(event)
    db.commit()
    db.refresh(event)
    return event_out(event)


@admin_router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventPayload,
    response: Response,
    _user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "活动不存在")
    if event.publication_status == "cancelled":
        raise HTTPException(409, "已取消的活动不能编辑")
    followers_notified = 0
    before = {field: getattr(event, field) for field in TRACKED_FIELDS}
    apply_payload(event, payload)
    if event.publication_status == "published":
        require_publishable(event)
        changed = [
            field
            for field in TRACKED_FIELDS
            if (as_utc(before[field]) if isinstance(before[field], datetime) else before[field])
            != (
                as_utc(getattr(event, field))
                if isinstance(getattr(event, field), datetime)
                else getattr(event, field)
            )
        ]
        if changed:
            followers_notified = notify_followers(db, event, "event_changed", changed)
    db.commit()
    db.refresh(event)
    return event_out(event, followers_notified=followers_notified)


@admin_router.post("/{event_id}/publish", response_model=EventOut)
def publish_event(
    event_id: int,
    response: Response,
    _user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "活动不存在")
    if event.publication_status == "cancelled":
        raise HTTPException(409, "已取消的活动不能重新发布")
    previous_change = db.scalar(
        select(EventChange)
        .where(EventChange.event_id == event.id)
        .order_by(EventChange.id.desc())
        .limit(1)
    )
    require_publishable(event)
    event.publication_status = "published"
    if previous_change and previous_change.kind == "event_withdrawn":
        notify_followers(db, event, "event_republished")
    db.commit()
    db.refresh(event)
    return event_out(event)


@admin_router.post("/{event_id}/withdraw", response_model=EventOut)
def withdraw_event(
    event_id: int,
    response: Response,
    _user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "活动不存在")
    if event.publication_status == "cancelled":
        raise HTTPException(409, "已取消的活动不能撤回为草稿")
    was_published = event.publication_status == "published"
    event.publication_status = "draft"
    if was_published:
        notify_followers(db, event, "event_withdrawn")
    db.commit()
    db.refresh(event)
    return event_out(event)


@admin_router.post("/{event_id}/cancel", response_model=EventOut)
def cancel_event(
    event_id: int,
    payload: EventCancelPayload,
    response: Response,
    _user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> EventOut:
    no_store(response)
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(404, "活动不存在")
    if event.publication_status != "published":
        raise HTTPException(409, "只有已发布的活动可以取消")
    event.publication_status = "cancelled"
    event.cancellation_reason = payload.reason
    notify_followers(db, event, "event_cancelled")
    db.commit()
    db.refresh(event)
    return event_out(event)
