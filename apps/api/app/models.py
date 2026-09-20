from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.db import Base

MAX_PROFILE_LINKS = 5
# 评论只允许「评论 → 回复 → 回复的回复」三级
MAX_COMMENT_DEPTH = 3
# 站点配置是单行表，固定用这个主键
SITE_CONFIG_ID = 1


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
    # 个人主页顶部的背景图
    banner_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    # 资料行与管理员标记几乎每次展示用户都要用到，直接联表取出，避免逐个懒加载
    detail: Mapped["ProfileDetail | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="joined"
    )
    articles: Mapped[list["Article"]] = relationship(
        back_populates="author", cascade="all, delete-orphan"
    )
    # 后台添加的管理员，按地址关联；服务器配置里的白名单不落在表里
    admin_entry: Mapped["AdminUser | None"] = relationship(
        primaryjoin="foreign(AdminUser.address) == User.address",
        viewonly=True,
        uselist=False,
        lazy="joined",
    )

    @property
    def is_admin(self) -> bool:
        return self.address.lower() in settings.admin_addresses or self.admin_entry is not None

    @property
    def is_banned(self) -> bool:
        return bool(self.moderation and self.moderation.is_banned)

    # 以下属性把扩展资料摊平到用户对象上，公开主页与 /auth/me 可以直接复用同一套模型
    @property
    def cohort(self) -> str:
        return self.detail.cohort if self.detail else ""

    @property
    def school(self) -> str:
        return self.detail.school if self.detail else ""

    @property
    def major(self) -> str:
        return self.detail.major if self.detail else ""

    @property
    def university(self) -> str:
        return self.detail.university if self.detail else ""

    @property
    def links(self) -> list[dict[str, str]]:
        return list(self.detail.links) if self.detail and self.detail.links else []


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(140), default="")
    # 板块名，空串表示未选择；用于论坛列表分页筛选
    topic: Mapped[str] = mapped_column(String(20), default="", index=True)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    author: Mapped[User] = relationship(back_populates="posts")
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class Comment(Base):
    """帖子评论，最多三级：一级评论、二级回复、三级回复。"""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # 回复的目标；为空表示这是帖子上的一级评论
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    depth: Mapped[int] = mapped_column(default=1)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    post: Mapped[Post] = relationship(back_populates="comments")
    author: Mapped[User] = relationship()
    # 删掉一级评论时，其下的回复一并删除
    replies: Mapped[list["Comment"]] = relationship(
        back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["Comment | None"] = relationship(back_populates="replies", remote_side=[id])


class AdminUser(Base):
    """后台添加的管理员。与服务器配置的 ADMIN_ADDRESSES 取并集。"""

    __tablename__ = "admin_users"

    address: Mapped[str] = mapped_column(String(42), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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


class ProfileDetail(Base):
    """入学年份、学院、专业、学校与个人链接。独立成表，存量 users 表无需破坏性迁移。"""

    __tablename__ = "profile_details"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    # 入学年份，四位年份，例如 2023
    cohort: Mapped[str] = mapped_column(String(4), default="")
    # 学院
    school: Mapped[str] = mapped_column(String(80), default="")
    # 专业
    major: Mapped[str] = mapped_column(String(80), default="")
    # 非北邮成员填写的学校，留空默认按北京邮电大学展示
    university: Mapped[str] = mapped_column(String(80), default="")
    links: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    user: Mapped[User] = relationship(back_populates="detail")


class Article(Base):
    """Markdown 文章。置顶文章按 sort_order 排序，未置顶按发布时间倒序。"""

    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(140))
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    author: Mapped[User] = relationship(back_populates="articles")


class SiteConfig(Base):
    """站点级配置，全站只有 SITE_CONFIG_ID 这一行。

    目前承载首页的社区群二维码与公告；换成通用 KV 会失去字段类型与校验，
    因此这里按需要显式加列。
    """

    __tablename__ = "site_config"

    id: Mapped[int] = mapped_column(primary_key=True, default=SITE_CONFIG_ID)
    # 首页「加入社区群」展示的二维码，为空表示首页不展示该区块
    group_qrcode_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 首页首屏顶部的公告，内容按 Markdown 渲染，为空表示不展示公告
    announcement: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Notification(Base):
    """有人回复了你的帖子或评论时留下的站内消息。

    user_id 是收件人，actor_id 是触发消息的人。SQLite 默认不打开外键级联，
    因此帖子和评论被删除时，由路由显式清理对应的消息行。
    """

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    comment_id: Mapped[int] = mapped_column(
        ForeignKey("comments.id", ondelete="CASCADE"), index=True
    )
    # post_comment：评论了你的帖子；comment_reply：回复了你的评论
    kind: Mapped[str] = mapped_column(String(20))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    # 指向 users 的外键有两个，必须显式指明用哪一个
    actor: Mapped[User] = relationship(foreign_keys=[actor_id])
    post: Mapped[Post] = relationship()
    comment: Mapped[Comment] = relationship()
