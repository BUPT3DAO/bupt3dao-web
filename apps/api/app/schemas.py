from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator


def _as_utc(value: datetime) -> datetime:
    """SQLite 读回的 datetime 不带时区，这里统一按 UTC 补上，避免前端解析成当地时间。"""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


UTCDateTime = Annotated[datetime, BeforeValidator(_as_utc)]


class UserBrief(BaseModel):
    """帖子卡片里展示的作者信息。"""

    model_config = ConfigDict(from_attributes=True)

    address: str
    nickname: str
    avatar_url: str | None = None


class UserPublic(UserBrief):
    bio: str
    created_at: UTCDateTime
    is_admin: bool = False


class UserProfile(UserPublic):
    post_count: int = 0


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nickname: str | None = Field(default=None, max_length=32)
    bio: str | None = Field(default=None, max_length=500)

    @field_validator("nickname", "bio")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class NonceRequest(BaseModel):
    address: str


class NonceResponse(BaseModel):
    nonce: str
    message: str


class VerifyRequest(BaseModel):
    message: str
    signature: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("内容不能为空")
        return text


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    created_at: UTCDateTime
    author: UserBrief


class PostListOut(BaseModel):
    items: list[PostOut]
    total: int


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=80)
    cohort: str = Field(default="", max_length=40)
    introduction: str = Field(default="", max_length=500)
    sort_order: int = Field(default=0, ge=0, le=10000)


class MemberOut(MemberUpdate):
    model_config = ConfigDict(from_attributes=True)

    user: UserPublic


class MemberListOut(BaseModel):
    items: list[MemberOut]
    total: int


class BanUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    is_banned: bool
    reason: str = Field(default="", max_length=300)


class AdminUserOut(UserPublic):
    is_banned: bool
    ban_reason: str = ""
    post_count: int = 0
    featured: MemberOut | None = None


class AdminUserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int
