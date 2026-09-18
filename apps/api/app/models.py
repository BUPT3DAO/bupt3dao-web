from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 钱包地址是唯一身份，统一小写存储
    address: Mapped[str] = mapped_column(String(42), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(32), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    posts: Mapped[list["Post"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    moderation: Mapped["UserModeration | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    featured: Mapped["FeaturedMember | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def is_admin(self) -> bool:
        return self.address.lower() in settings.admin_addresses

    @property
    def is_banned(self) -> bool:
        return bool(self.moderation and self.moderation.is_banned)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    author: Mapped[User] = relationship(back_populates="posts")


# 新能力使用独立表，既有 SQLite 用户和帖子表无需破坏性迁移。
class UserModeration(Base):
    __tablename__ = "user_moderation"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(String(300), default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    user: Mapped[User] = relationship(back_populates="moderation")


class FeaturedMember(Base):
    __tablename__ = "featured_members"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    title: Mapped[str] = mapped_column(String(80))
    cohort: Mapped[str] = mapped_column(String(40), default="")
    introduction: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(default=0)
    user: Mapped[User] = relationship(back_populates="featured")
