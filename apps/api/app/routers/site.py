"""站点级公开配置：首页的社区群二维码等，任何人都可以读。"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SITE_CONFIG_ID, SiteConfig
from app.schemas import SiteConfigOut

router = APIRouter(prefix="/site", tags=["site"])


@router.get("", response_model=SiteConfigOut)
def get_site_config(db: Session = Depends(get_db)) -> SiteConfigOut:
    """没配置过时返回空值，前端据此决定是否展示对应区块。"""
    config = db.get(SiteConfig, SITE_CONFIG_ID)
    if config is None:
        return SiteConfigOut()
    return SiteConfigOut.model_validate(config)
