"""Authenticated game configuration. Progress and transactions live on the test chain."""

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.config import settings
from app.models import User
from app.security import get_current_user

router = APIRouter(prefix="/game", tags=["game"])


class GameConfig(BaseModel):
    enabled: bool
    chain_id: int = 84532
    contract_address: str | None = None
    rpc_url: str
    explorer_url: str | None
    faucet_url: str | None


@router.get("/status")
def get_game_status(response: Response) -> dict[str, bool]:
    """Only expose the launch switch so navigation stays hidden until launch."""
    response.headers["Cache-Control"] = "no-store"
    return {"enabled": settings.game_enabled}


@router.get("/config", response_model=GameConfig)
def get_game_config(response: Response, _user: User = Depends(get_current_user)) -> GameConfig:
    response.headers["Cache-Control"] = "private, no-store"
    enabled = settings.game_enabled
    return GameConfig(
        enabled=enabled,
        chain_id=settings.game_chain_id,
        contract_address=settings.game_contract_address if enabled else None,
        rpc_url=settings.game_rpc_url,
        explorer_url="https://sepolia.basescan.org" if settings.game_chain_id == 84532 else None,
        faucet_url="https://docs.base.org/get-started/get-funds"
        if settings.game_chain_id == 84532
        else None,
    )
