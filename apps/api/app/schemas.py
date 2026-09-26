from datetime import datetime, timezone
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

from app.models import MAX_PROFILE_LINKS

BIO_MAX_LENGTH = 2000
POST_TITLE_MAX_LENGTH = 140
POST_CONTENT_MAX_LENGTH = 2000
COMMENT_CONTENT_MAX_LENGTH = 2000
ARTICLE_CONTENT_MAX_LENGTH = 20000
ANNOUNCEMENT_MAX_LENGTH = 5000

# 帖子板块；空字符串表示「全部动态」
POST_TOPICS = ("技术交流", "项目共建", "校园日常")


def _as_utc(value: datetime) -> datetime:
    """SQLite 读回的 datetime 不带时区，这里统一按 UTC 补上，避免前端解析成当地时间。"""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


UTCDateTime = Annotated[datetime, BeforeValidator(_as_utc)]


class ProfileLink(BaseModel):
    """个人主页上的外链，label 留空时前端用域名兜底显示。"""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    label: str = Field(default="", max_length=24)
    url: str = Field(min_length=1, max_length=300)

    @field_validator("url")
    @classmethod
    def check_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("链接需要是以 http:// 或 https:// 开头的完整地址")
        return value


class UserBrief(BaseModel):
    """帖子、评论、文章里展示的作者信息；悬浮卡片也用同一份数据。"""

    model_config = ConfigDict(from_attributes=True)

    address: str
    nickname: str
    avatar_url: str | None = None
    banner_url: str | None = None
    cohort: str = ""
    school: str = ""
    major: str = ""
    university: str = ""


class UserPublic(UserBrief):
    bio: str
    created_at: UTCDateTime
    is_admin: bool = False
    links: list[ProfileLink] = Field(default_factory=list)


class UserProfile(UserPublic):
    post_count: int = 0


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nickname: str | None = Field(default=None, max_length=32)
    bio: str | None = Field(default=None, max_length=BIO_MAX_LENGTH)
    cohort: str | None = Field(default=None, max_length=4)
    school: str | None = Field(default=None, max_length=80)
    major: str | None = Field(default=None, max_length=80)
    university: str | None = Field(default=None, max_length=80)
    links: list[ProfileLink] | None = Field(default=None, max_length=MAX_PROFILE_LINKS)

    @field_validator("nickname", "bio", "school", "major", "university")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @field_validator("cohort")
    @classmethod
    def check_cohort(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cohort = value.strip()
        if not cohort:
            return ""
        if len(cohort) != 4 or not cohort.isdigit():
            raise ValueError("入学年份请填写 4 位年份，例如 2023")
        return cohort


class NonceRequest(BaseModel):
    address: str


class NonceResponse(BaseModel):
    nonce: str
    message: str


class VerifyRequest(BaseModel):
    # 登录签名消息很短；限制请求字段，避免匿名接口接收无界大字符串。
    message: str = Field(min_length=1, max_length=2048)
    signature: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class PostCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=POST_TITLE_MAX_LENGTH)
    topic: str = Field(default="", max_length=20)
    content: str = Field(min_length=1, max_length=POST_CONTENT_MAX_LENGTH)

    @field_validator("title")
    @classmethod
    def check_title(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("标题不能为空")
        return text

    @field_validator("content")
    @classmethod
    def check_content(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("内容不能为空")
        return text

    @field_validator("topic")
    @classmethod
    def check_topic(cls, value: str) -> str:
        topic = value.strip()
        if topic and topic not in POST_TOPICS:
            raise ValueError("请选择有效的板块")
        return topic


class PostSummary(BaseModel):
    """列表页只要标题与统计信息，正文放在详情页里取。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    topic: str
    excerpt: str = ""
    created_at: UTCDateTime
    comment_count: int = 0
    author: UserBrief


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    topic: str
    content: str
    created_at: UTCDateTime
    comment_count: int = 0
    author: UserBrief


class PostListOut(BaseModel):
    items: list[PostSummary]
    total: int


class CommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=COMMENT_CONTENT_MAX_LENGTH)
    # 为空表示直接评论帖子，否则回复指定评论
    parent_id: int | None = Field(default=None, ge=1)

    @field_validator("content")
    @classmethod
    def check_content(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("评论不能为空")
        return text


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    depth: int
    created_at: UTCDateTime
    author: UserBrief
    replies: list["CommentOut"] = Field(default_factory=list)


class CommentListOut(BaseModel):
    items: list[CommentOut]
    total: int


class NotificationOut(BaseModel):
    """站内消息：谁回复了你的帖子或评论。点击后跳转 post_id 对应的帖子。"""

    id: int
    kind: Literal["post_comment", "comment_reply"]
    is_read: bool
    created_at: UTCDateTime
    post_id: int
    post_title: str
    comment_id: int
    excerpt: str
    actor: UserBrief


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    total: int
    # 未读数随列表一起返回，侧边栏角标不必再单独请求
    unread: int


class NotificationSummaryOut(BaseModel):
    unread: int


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


class AdminCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    address: str = Field(min_length=42, max_length=42)


class AdminOut(BaseModel):
    """管理员列表要同时容纳「已在服务器配置里的地址」和「后台添加但还没登录过的地址」。"""

    address: str
    nickname: str = ""
    avatar_url: str | None = None
    banner_url: str | None = None
    cohort: str = ""
    school: str = ""
    major: str = ""
    university: str = ""
    # 该地址是否已经通过钱包登录注册
    registered: bool = False
    # 权限来自服务器环境变量，不能在后台移除
    from_config: bool = False
    added_at: UTCDateTime | None = None


class AdminListOut(BaseModel):
    items: list[AdminOut]
    total: int


class UploadedImageOut(BaseModel):
    url: str


class SiteConfigOut(BaseModel):
    """站点公开配置。前端拿不到图片时前端自己决定怎么展示。"""

    model_config = ConfigDict(from_attributes=True)

    group_qrcode_url: str | None = None
    announcement: str = ""


class SiteAnnouncementUpdate(BaseModel):
    """首页公告正文，按 Markdown 渲染。空字符串表示撤下公告。"""

    content: str = Field(default="", max_length=ANNOUNCEMENT_MAX_LENGTH)


class ArticlePayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=140)
    content: str = Field(min_length=1, max_length=ARTICLE_CONTENT_MAX_LENGTH)


class ArticleOut(ArticlePayload):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_pinned: bool
    sort_order: int
    created_at: UTCDateTime
    updated_at: UTCDateTime
    author: UserBrief


class ArticleSummary(BaseModel):
    """列表页只要摘要，避免把全文塞进列表响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    excerpt: str
    is_pinned: bool
    sort_order: int
    created_at: UTCDateTime
    updated_at: UTCDateTime
    author: UserBrief


class ArticleListOut(BaseModel):
    items: list[ArticleSummary]
    total: int


class ArticlePinUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_pinned: bool


class ArticleMoveUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    direction: Literal["up", "down"]
