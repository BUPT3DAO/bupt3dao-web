"""所有管理操作都经过实时白名单与封禁状态校验。"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.models import (
    SITE_CONFIG_ID,
    AdminUser,
    Article,
    FeaturedMember,
    Post,
    SiteConfig,
    User,
    UserModeration,
)
from app.routers.articles import ARTICLE_ORDER
from app.routers.articles import summary_of as article_summary
from app.routers.posts import count_comments
from app.routers.posts import summary_of as post_summary
from app.schemas import (
    AdminCreate,
    AdminListOut,
    AdminOut,
    AdminUserListOut,
    AdminUserOut,
    ArticleListOut,
    ArticleMoveUpdate,
    ArticlePinUpdate,
    ArticleSummary,
    BanUpdate,
    MemberOut,
    MemberUpdate,
    PostListOut,
    SiteAnnouncementUpdate,
    SiteConfigOut,
)
from app.security import get_admin
from app.siwe import SiweError, normalize_address
from app.uploads import remove_image, save_image

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_admin)])

# 置顶文章排在最后时会先落到这个序号上，再由 _renumber_pinned 统一重排
_PIN_APPEND_ORDER = 10**6


def find_user(db: Session, address: str) -> User:
    try:
        address = normalize_address(address)
    except SiweError as exc:
        raise HTTPException(400, str(exc)) from exc
    user = db.scalar(select(User).where(User.address == address))
    if user is None:
        raise HTTPException(404, "用户尚未注册，请先邀请对方通过钱包登录")
    return user


def user_out(user: User, count: int = 0) -> AdminUserOut:
    return AdminUserOut(
        address=user.address,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        banner_url=user.banner_url,
        bio=user.bio,
        created_at=user.created_at,
        is_admin=user.is_admin,
        is_banned=user.is_banned,
        ban_reason=user.moderation.reason if user.moderation else "",
        post_count=count,
        cohort=user.cohort,
        school=user.school,
        major=user.major,
        university=user.university,
        links=user.links,
        featured=MemberOut.model_validate(user.featured) if user.featured else None,
    )


@router.get("/users", response_model=AdminUserListOut)
def list_users(
    q: str = Query("", max_length=100),
    featured_only: bool = False,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> AdminUserListOut:
    query = select(User)
    if q.strip():
        query = query.where(
            or_(
                User.nickname.contains(q.strip(), autoescape=True),
                User.address.contains(q.strip().lower(), autoescape=True),
            )
        )
    if featured_only:
        query = query.where(User.featured.has())
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(
        query.options(selectinload(User.moderation), selectinload(User.featured))
        .order_by(User.created_at.desc(), User.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    counts = dict(
        db.execute(
            select(Post.author_id, func.count())
            .where(Post.author_id.in_([user.id for user in users]))
            .group_by(Post.author_id)
        ).all()
    )
    return AdminUserListOut(
        items=[user_out(user, counts.get(user.id, 0)) for user in users], total=total
    )


@router.patch("/users/{address}/ban", response_model=AdminUserOut)
def ban_user(address: str, payload: BanUpdate, db: Session = Depends(get_db)) -> AdminUserOut:
    user = find_user(db, address)
    if user.is_admin:
        raise HTTPException(403, "不能封禁管理员账号，请先在「管理员」里移除其权限")
    if user.moderation is None:
        user.moderation = UserModeration()
    user.moderation.is_banned = payload.is_banned
    user.moderation.reason = payload.reason if payload.is_banned else ""
    db.commit()
    return user_out(user)


def admin_out(user: User | None, address: str, entry: AdminUser | None) -> AdminOut:
    return AdminOut(
        address=address,
        nickname=user.nickname if user else "",
        avatar_url=user.avatar_url if user else None,
        banner_url=user.banner_url if user else None,
        cohort=user.cohort if user else "",
        school=user.school if user else "",
        major=user.major if user else "",
        university=user.university if user else "",
        registered=user is not None,
        from_config=address in settings.admin_addresses,
        added_at=entry.created_at if entry else None,
    )


def _admins_payload(db: Session) -> AdminListOut:
    entries = db.scalars(select(AdminUser).order_by(AdminUser.created_at, AdminUser.address)).all()
    # 服务器配置里的管理员排在最前，后台添加的按添加时间跟在后面
    addresses = list(
        dict.fromkeys([*settings.admin_addresses, *(entry.address for entry in entries)])
    )
    users = {
        item.address: item
        for item in db.scalars(select(User).where(User.address.in_(addresses))).all()
    }
    entry_map = {entry.address: entry for entry in entries}
    items = [
        admin_out(users.get(address), address, entry_map.get(address)) for address in addresses
    ]
    return AdminListOut(items=items, total=len(items))


@router.get("/admins", response_model=AdminListOut)
def list_admins(db: Session = Depends(get_db)) -> AdminListOut:
    return _admins_payload(db)


@router.post("/admins", response_model=AdminOut, status_code=status.HTTP_201_CREATED)
def add_admin(payload: AdminCreate, db: Session = Depends(get_db)) -> AdminOut:
    try:
        address = normalize_address(payload.address)
    except SiweError as exc:
        raise HTTPException(400, str(exc)) from exc

    # 现有管理员可以直接添加，不需要任何审批；对方下次用钱包登录即生效
    if address in settings.admin_addresses or db.get(AdminUser, address) is not None:
        raise HTTPException(409, "该地址已经是管理员")

    entry = AdminUser(address=address)
    db.add(entry)
    db.commit()
    return admin_out(db.scalar(select(User).where(User.address == address)), address, entry)


@router.delete("/admins/{address}", status_code=status.HTTP_204_NO_CONTENT)
def remove_admin(
    address: str,
    user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> None:
    try:
        normalized = normalize_address(address)
    except SiweError as exc:
        raise HTTPException(400, str(exc)) from exc

    if normalized in settings.admin_addresses:
        raise HTTPException(409, "该管理员的权限来自服务器配置，无法在后台移除")
    if normalized == user.address:
        raise HTTPException(409, "不能移除自己的管理员身份")

    entry = db.get(AdminUser, normalized)
    if entry is None:
        raise HTTPException(404, "该地址不是管理员")
    db.delete(entry)
    db.commit()


@router.get("/posts", response_model=PostListOut)
def list_posts(
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PostListOut:
    query = select(Post).join(User)
    if q.strip():
        query = query.where(
            or_(
                Post.title.contains(q.strip(), autoescape=True),
                Post.content.contains(q.strip(), autoescape=True),
                User.nickname.contains(q.strip(), autoescape=True),
                User.address.contains(q.strip().lower(), autoescape=True),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    posts = db.scalars(
        query.options(selectinload(Post.author))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    counts = count_comments(db, [post.id for post in posts])
    return PostListOut(
        items=[post_summary(post, counts.get(post.id, 0)) for post in posts], total=total
    )


@router.put("/members/{address}", response_model=MemberOut)
def feature_member(
    address: str,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
) -> MemberOut:
    user = find_user(db, address)
    if user.is_banned:
        raise HTTPException(409, "请先解封用户，再编辑校友墙展示")
    if user.featured is None:
        user.featured = FeaturedMember()
    for key, value in payload.model_dump().items():
        setattr(user.featured, key, value)
    db.commit()
    return MemberOut.model_validate(user.featured)


@router.delete("/members/{address}", status_code=204)
def unfeature_member(address: str, db: Session = Depends(get_db)) -> None:
    user = find_user(db, address)
    if user.featured is not None:
        db.delete(user.featured)
        db.commit()


def _pinned_articles(db: Session) -> list[Article]:
    return list(
        db.scalars(
            select(Article)
            .where(Article.is_pinned.is_(True))
            .order_by(Article.sort_order, Article.id)
        ).all()
    )


def _renumber_pinned(db: Session) -> None:
    """把置顶顺序重排成 10、20、30…，避免历史值相同导致顺序不稳定。"""
    for position, article in enumerate(_pinned_articles(db)):
        article.sort_order = (position + 1) * 10


def find_article(db: Session, article_id: int) -> Article:
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(404, "文章不存在或已被删除")
    return article


@router.get("/articles", response_model=ArticleListOut)
def list_articles(
    q: str = Query("", max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> ArticleListOut:
    """管理端可以看到被封禁作者的文章，便于清理。"""
    query = select(Article).join(User)
    if q.strip():
        query = query.where(
            or_(
                Article.title.contains(q.strip(), autoescape=True),
                Article.content.contains(q.strip(), autoescape=True),
                User.nickname.contains(q.strip(), autoescape=True),
                User.address.contains(q.strip().lower(), autoescape=True),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    articles = db.scalars(
        query.options(selectinload(Article.author))
        .order_by(*ARTICLE_ORDER)
        .offset(offset)
        .limit(limit)
    ).all()
    return ArticleListOut(items=[article_summary(article) for article in articles], total=total)


@router.patch("/articles/{article_id}/pin", response_model=ArticleSummary)
def pin_article(
    article_id: int,
    payload: ArticlePinUpdate,
    db: Session = Depends(get_db),
) -> ArticleSummary:
    article = find_article(db, article_id)
    article.is_pinned = payload.is_pinned
    # 新置顶的排在末尾；取消置顶的回到按发布时间排序
    article.sort_order = _PIN_APPEND_ORDER if payload.is_pinned else 0
    db.flush()
    _renumber_pinned(db)
    db.commit()
    return article_summary(article)


@router.post("/articles/{article_id}/move", status_code=204)
def move_article(
    article_id: int,
    payload: ArticleMoveUpdate,
    db: Session = Depends(get_db),
) -> None:
    article = find_article(db, article_id)
    if not article.is_pinned:
        raise HTTPException(409, "只有置顶文章可以调整顺序")

    ordered = _pinned_articles(db)
    index = next((position for position, item in enumerate(ordered) if item.id == article.id), -1)
    target = index - 1 if payload.direction == "up" else index + 1
    if index < 0 or not 0 <= target < len(ordered):
        return None

    ordered[index], ordered[target] = ordered[target], ordered[index]
    for position, item in enumerate(ordered):
        item.sort_order = (position + 1) * 10
    db.commit()
    return None


def _site_config(db: Session) -> SiteConfig:
    """站点配置只有一行，第一次写入时按需建出来。"""
    config = db.get(SiteConfig, SITE_CONFIG_ID)
    if config is None:
        config = SiteConfig(id=SITE_CONFIG_ID)
        db.add(config)
    return config


@router.post("/site/qrcode", response_model=SiteConfigOut)
def upload_group_qrcode(
    file: UploadFile = File(...),
    user: User = Depends(get_admin),
    db: Session = Depends(get_db),
) -> SiteConfigOut:
    """更换首页的社区群二维码；旧图会从上传目录删掉，避免堆积。"""
    config = _site_config(db)
    url = save_image(file, user.address, settings.max_image_bytes, "二维码")
    remove_image(config.group_qrcode_url)
    config.group_qrcode_url = url
    db.commit()
    return SiteConfigOut.model_validate(config)


@router.delete("/site/qrcode", status_code=204)
def remove_group_qrcode(db: Session = Depends(get_db)) -> None:
    """移除二维码，首页的「加入社区群」区块随之隐藏。"""
    config = db.get(SiteConfig, SITE_CONFIG_ID)
    if config is None or config.group_qrcode_url is None:
        return
    remove_image(config.group_qrcode_url)
    config.group_qrcode_url = None
    db.commit()


@router.put("/site/announcement", response_model=SiteConfigOut)
def update_announcement(
    payload: SiteAnnouncementUpdate,
    db: Session = Depends(get_db),
) -> SiteConfigOut:
    """更新首页公告，内容按 Markdown 渲染；传空字符串即撤下公告。"""
    config = _site_config(db)
    config.announcement = payload.content.strip()
    db.commit()
    return SiteConfigOut.model_validate(config)
