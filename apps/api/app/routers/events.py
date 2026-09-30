"""社区活动。活动内容仅对已登录且未封禁的社区成员开放。"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Event, User
from app.schemas import EventCancelPayload, EventListOut, EventOut, EventPayload
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


def event_out(event: Event) -> EventOut:
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
        created_at=as_utc(event.created_at),
        updated_at=as_utc(event.updated_at),
    )


def event_list_out(events: list[Event], total: int) -> EventListOut:
    return EventListOut(items=[event_out(event) for event in events], total=total)


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
    return event_list_out(rows, total)


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
    return event_out(event)


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
    apply_payload(event, payload)
    if event.publication_status == "published":
        require_publishable(event)
    db.commit()
    db.refresh(event)
    return event_out(event)


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
    require_publishable(event)
    event.publication_status = "published"
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
    event.publication_status = "draft"
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
    db.commit()
    db.refresh(event)
    return event_out(event)
