"""文章墙：markdown 文章的发布、阅读与作者自维护。"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Article, User, UserModeration
from app.schemas import (
    ArticleListOut,
    ArticleOut,
    ArticlePayload,
    ArticleSummary,
)
from app.security import get_current_user

router = APIRouter(prefix="/articles", tags=["articles"])

EXCERPT_LENGTH = 160

# 摘要只用于列表展示，这里把常见的 markdown 记号抹成纯文本
EXCERPT_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"!\[([^\]]*)\]\([^)]*\)"), r"\1"),  # 图片 -> alt
    (re.compile(r"\[([^\]]*)\]\([^)]*\)"), r"\1"),  # 链接 -> 文字
    (re.compile(r"(?m)^\s{0,3}(?:#{1,6}\s*|>\s?|[-*+]\s+|\d+[.)]\s+)"), ""),  # 行首记号
    (re.compile(r"(?m)^\s*\|?[\s:|-]{3,}\|[\s:|-]*$\n?"), ""),  # 表格分隔行
    (re.compile(r"(?m)^\s*[-*_]{3,}\s*$\n?"), ""),  # 分隔线
    (re.compile(r"(\*\*|__|~~)(.+?)\1"), r"\2"),  # 加粗/删除线
    (re.compile(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])"), r"\1"),  # 斜体
    (re.compile(r"`+"), ""),  # 代码围栏与行内代码
    (re.compile(r"[ \t]{2,}"), " "),  # 抹掉记号后留下的多余空格
)

# 置顶文章在前并按管理员指定的顺序，其余按发布时间倒序
ARTICLE_ORDER = (
    Article.is_pinned.desc(),
    Article.sort_order.asc(),
    Article.created_at.desc(),
    Article.id.desc(),
)

VISIBLE = ~Article.author.has(User.moderation.has(UserModeration.is_banned.is_(True)))


def excerpt_of(content: str) -> str:
    """把 markdown 正文压成一行纯文本摘要。"""
    text = content
    for pattern, replacement in EXCERPT_RULES:
        text = pattern.sub(replacement, text)
    flattened = " ".join(line.strip() for line in text.splitlines() if line.strip())
    return flattened[:EXCERPT_LENGTH]


def summary_of(article: Article) -> ArticleSummary:
    return ArticleSummary(
        id=article.id,
        title=article.title,
        excerpt=excerpt_of(article.content),
        is_pinned=article.is_pinned,
        sort_order=article.sort_order,
        created_at=article.created_at,
        updated_at=article.updated_at,
        author=article.author,
    )


def find_article(db: Session, article_id: int) -> Article:
    article = db.get(Article, article_id)
    if article is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文章不存在或已被删除")
    return article


@router.get("", response_model=ArticleListOut)
def list_articles(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> ArticleListOut:
    total = db.scalar(select(func.count()).select_from(Article).where(VISIBLE)) or 0
    articles = db.scalars(
        select(Article)
        .where(VISIBLE)
        .options(selectinload(Article.author))
        .order_by(*ARTICLE_ORDER)
        .limit(limit)
        .offset(offset)
    ).all()
    return ArticleListOut(items=[summary_of(article) for article in articles], total=total)


@router.get("/{article_id}", response_model=ArticleOut)
def get_article(article_id: int, db: Session = Depends(get_db)) -> ArticleOut:
    article = find_article(db, article_id)
    if article.author.is_banned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "文章不存在或已被删除")
    return ArticleOut.model_validate(article)


@router.post("", response_model=ArticleOut, status_code=status.HTTP_201_CREATED)
def create_article(
    payload: ArticlePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ArticleOut:
    article = Article(title=payload.title, content=payload.content, author_id=user.id, author=user)
    db.add(article)
    db.commit()
    return ArticleOut.model_validate(article)


@router.put("/{article_id}", response_model=ArticleOut)
def update_article(
    article_id: int,
    payload: ArticlePayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ArticleOut:
    article = find_article(db, article_id)
    if article.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只能编辑自己的文章")
    article.title = payload.title
    article.content = payload.content
    db.commit()
    return ArticleOut.model_validate(article)


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    article = find_article(db, article_id)
    if article.author_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只能删除自己的文章")
    db.delete(article)
    db.commit()
