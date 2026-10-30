"""社区抽奖：已登录成员按管理员配置的选项与权重转盘抽取，不限次数。

只有最新一轮生效；管理员开始新一轮时沿用选项，旧轮次的记录保留。
"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import LotteryCampaign, LotteryDraw, LotteryPrize, User
from app.schemas import (
    LOTTERY_MAX_PRIZES,
    LotteryAdminOut,
    LotteryCampaignOut,
    LotteryCampaignPayload,
    LotteryDeliveredUpdate,
    LotteryDrawOut,
    LotteryMineOut,
    LotteryOut,
    LotteryPrizeOut,
    LotteryPrizePayload,
    LotteryRecordListOut,
    LotteryRecordOut,
    LotteryStatusOut,
    UserBrief,
)
from app.security import get_admin, get_current_user

router = APIRouter(prefix="/lottery", tags=["lottery"])
admin_router = APIRouter(
    prefix="/admin/lottery", tags=["admin-lottery"], dependencies=[Depends(get_admin)]
)

# 抽奖结果用系统级随机源，不能被预测
_rng = secrets.SystemRandom()


def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


def current_campaign(db: Session) -> LotteryCampaign | None:
    return db.scalar(
        select(LotteryCampaign)
        .options(selectinload(LotteryCampaign.prizes))
        .order_by(LotteryCampaign.id.desc())
        .limit(1)
    )


def campaign_out(campaign: LotteryCampaign) -> LotteryCampaignOut:
    total_weight = sum(prize.weight for prize in campaign.prizes)
    prizes = [
        LotteryPrizeOut.model_validate(prize).model_copy(
            update={"chance": round(prize.weight / total_weight * 100, 1) if total_weight else 0}
        )
        for prize in campaign.prizes
    ]
    return LotteryCampaignOut(
        id=campaign.id,
        title=campaign.title,
        description=campaign.description,
        is_open=campaign.is_open,
        updated_at=campaign.updated_at,
        prizes=prizes,
    )


@router.get("/status", response_model=LotteryStatusOut)
def lottery_status(response: Response, db: Session = Depends(get_db)) -> LotteryStatusOut:
    no_store(response)
    campaign = current_campaign(db)
    return LotteryStatusOut(open=bool(campaign and campaign.is_open))


@router.get("", response_model=LotteryOut)
def get_lottery(response: Response, db: Session = Depends(get_db)) -> LotteryOut:
    no_store(response)
    campaign = current_campaign(db)
    return LotteryOut(campaign=campaign_out(campaign) if campaign else None)


@router.get("/me", response_model=LotteryMineOut)
def my_draws(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LotteryMineOut:
    no_store(response)
    campaign = current_campaign(db)
    if campaign is None:
        return LotteryMineOut(draws=[])
    draws = db.scalars(
        select(LotteryDraw)
        .where(LotteryDraw.campaign_id == campaign.id, LotteryDraw.user_id == user.id)
        .order_by(LotteryDraw.created_at.desc(), LotteryDraw.id.desc())
        .limit(50)
    ).all()
    return LotteryMineOut(draws=[LotteryDrawOut.model_validate(item) for item in draws])


@router.post("/draw", response_model=LotteryDrawOut)
def draw(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LotteryDrawOut:
    no_store(response)
    campaign = current_campaign(db)
    if campaign is None or not campaign.is_open:
        raise HTTPException(status.HTTP_409_CONFLICT, "抽奖暂未开放")
    candidates = [prize for prize in campaign.prizes if prize.weight > 0]
    if not candidates:
        raise HTTPException(status.HTTP_409_CONFLICT, "暂无可抽选项")
    prize = _rng.choices(candidates, weights=[item.weight for item in candidates])[0]
    record = LotteryDraw(
        campaign_id=campaign.id, user_id=user.id, prize_id=prize.id, prize_name=prize.name
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return LotteryDrawOut.model_validate(record)


def require_campaign(db: Session) -> LotteryCampaign:
    campaign = current_campaign(db)
    if campaign is None:
        raise HTTPException(404, "请先保存抽奖设置")
    return campaign


def find_prize(db: Session, prize_id: int) -> LotteryPrize:
    campaign = require_campaign(db)
    prize = next((item for item in campaign.prizes if item.id == prize_id), None)
    if prize is None:
        raise HTTPException(404, "选项不存在或不属于当前轮次")
    return prize


def admin_out(db: Session, campaign: LotteryCampaign | None) -> LotteryAdminOut:
    if campaign is None:
        return LotteryAdminOut()
    participants, total = db.execute(
        select(func.count(func.distinct(LotteryDraw.user_id)), func.count(LotteryDraw.id)).where(
            LotteryDraw.campaign_id == campaign.id
        )
    ).one()
    return LotteryAdminOut(
        campaign=campaign_out(campaign), participants=participants, total_draws=total
    )


@admin_router.get("", response_model=LotteryAdminOut)
def admin_get_lottery(response: Response, db: Session = Depends(get_db)) -> LotteryAdminOut:
    no_store(response)
    return admin_out(db, current_campaign(db))


@admin_router.put("", response_model=LotteryAdminOut)
def admin_save_lottery(
    payload: LotteryCampaignPayload,
    response: Response,
    db: Session = Depends(get_db),
) -> LotteryAdminOut:
    no_store(response)
    campaign = current_campaign(db)
    if campaign is None:
        campaign = LotteryCampaign()
        db.add(campaign)
    campaign.title = payload.title
    campaign.description = payload.description
    campaign.is_open = payload.is_open
    db.commit()
    return admin_out(db, current_campaign(db))


@admin_router.post("/rounds", response_model=LotteryAdminOut, status_code=201)
def admin_new_round(response: Response, db: Session = Depends(get_db)) -> LotteryAdminOut:
    """开始新一轮：沿用标题、说明和选项，记录从零开始，新一轮默认关闭。"""
    no_store(response)
    previous = require_campaign(db)
    previous.is_open = False
    campaign = LotteryCampaign(
        title=previous.title, description=previous.description, is_open=False
    )
    campaign.prizes = [
        LotteryPrize(name=prize.name, weight=prize.weight, sort_order=prize.sort_order)
        for prize in previous.prizes
    ]
    db.add(campaign)
    db.commit()
    return admin_out(db, current_campaign(db))


@admin_router.post("/prizes", response_model=LotteryAdminOut, status_code=201)
def admin_add_prize(
    payload: LotteryPrizePayload,
    response: Response,
    db: Session = Depends(get_db),
) -> LotteryAdminOut:
    no_store(response)
    campaign = require_campaign(db)
    if len(campaign.prizes) >= LOTTERY_MAX_PRIZES:
        raise HTTPException(400, f"最多 {LOTTERY_MAX_PRIZES} 个选项")
    next_order = max((prize.sort_order for prize in campaign.prizes), default=0) + 1
    campaign.prizes.append(
        LotteryPrize(name=payload.name, weight=payload.weight, sort_order=next_order)
    )
    db.commit()
    return admin_out(db, current_campaign(db))


@admin_router.put("/prizes/{prize_id}", response_model=LotteryAdminOut)
def admin_update_prize(
    prize_id: int,
    payload: LotteryPrizePayload,
    response: Response,
    db: Session = Depends(get_db),
) -> LotteryAdminOut:
    no_store(response)
    prize = find_prize(db, prize_id)
    prize.name = payload.name
    prize.weight = payload.weight
    db.commit()
    return admin_out(db, current_campaign(db))


@admin_router.delete("/prizes/{prize_id}", response_model=LotteryAdminOut)
def admin_delete_prize(
    prize_id: int,
    response: Response,
    db: Session = Depends(get_db),
) -> LotteryAdminOut:
    no_store(response)
    db.delete(find_prize(db, prize_id))
    db.commit()
    return admin_out(db, current_campaign(db))


@admin_router.get("/records", response_model=LotteryRecordListOut)
def admin_records(
    response: Response,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> LotteryRecordListOut:
    no_store(response)
    campaign = current_campaign(db)
    if campaign is None:
        return LotteryRecordListOut(items=[], total=0)
    query = select(LotteryDraw).where(LotteryDraw.campaign_id == campaign.id)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.options(selectinload(LotteryDraw.user))
        .order_by(LotteryDraw.created_at.desc(), LotteryDraw.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return LotteryRecordListOut(
        items=[
            LotteryRecordOut(
                **LotteryDrawOut.model_validate(row).model_dump(),
                user=UserBrief.model_validate(row.user),
            )
            for row in rows
        ],
        total=total,
    )


@admin_router.patch("/draws/{draw_id}", response_model=LotteryDrawOut)
def admin_mark_delivered(
    draw_id: int,
    payload: LotteryDeliveredUpdate,
    response: Response,
    db: Session = Depends(get_db),
) -> LotteryDrawOut:
    no_store(response)
    record = db.get(LotteryDraw, draw_id)
    if record is None:
        raise HTTPException(404, "抽奖记录不存在")
    record.delivered = payload.delivered
    db.commit()
    db.refresh(record)
    return LotteryDrawOut.model_validate(record)
