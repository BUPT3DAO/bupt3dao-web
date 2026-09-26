"""帖子：贴吧式列表、主题帖详情与三级评论。"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import MAX_COMMENT_DEPTH, Comment, Notification, Post, User, UserModeration
from app.routers.articles import excerpt_of
from app.schemas import (
    CommentCreate,
    CommentListOut,
    CommentOut,
    PostCreate,
    PostListOut,
    PostOut,
    PostSummary,
    UserBrief,
)
from app.security import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])

# 被封禁作者的帖子与评论不出现在公开页面
VISIBLE_POST = ~Post.author.has(User.moderation.has(UserModeration.is_banned.is_(True)))
VISIBLE_COMMENT = ~Comment.author.has(User.moderation.has(UserModeration.is_banned.is_(True)))


def find_post(db: Session, post_id: int) -> Post:
    post = db.get(Post, post_id)
    if post is None or post.author.is_banned:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "帖子不存在或已被删除")
    return post


def count_comments(db: Session, post_ids: list[int]) -> dict[int, int]:
    if not post_ids:
        return {}
    rows = db.execute(
        select(Comment.post_id, func.count())
        .where(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
    ).all()
    return {post_id: total for post_id, total in rows}


def summary_of(post: Post, comment_count: int) -> PostSummary:
    return PostSummary(
        id=post.id,
        title=post.title,
        topic=post.topic,
        excerpt=excerpt_of(post.content),
        created_at=post.created_at,
        comment_count=comment_count,
        author=post.author,
    )


def detail_of(post: Post, comment_count: int) -> PostOut:
    return PostOut(
        id=post.id,
        title=post.title,
        topic=post.topic,
        content=post.content,
        created_at=post.created_at,
        comment_count=comment_count,
        author=post.author,
    )


def build_tree(comments: list[Comment]) -> list[CommentOut]:
    """按父子关系拼出三级评论树；父评论不可见时，其下的回复一并隐藏。"""
    nodes = {
        comment.id: CommentOut(
            id=comment.id,
            content=comment.content,
            depth=comment.depth,
            created_at=comment.created_at,
            author=UserBrief.model_validate(comment.author),
        )
        for comment in comments
    }
    roots: list[CommentOut] = []
    for comment in comments:
        node = nodes[comment.id]
        if comment.parent_id is None:
            roots.append(node)
            continue
        parent = nodes.get(comment.parent_id)
        if parent is not None:
            parent.replies.append(node)
    return roots


@router.get("", response_model=PostListOut)
def list_posts(
    q: str = Query("", max_length=100),
    topic: str = Query("", max_length=20),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PostListOut:
    query = select(Post).where(VISIBLE_POST)
    if topic.strip():
        query = query.where(Post.topic == topic.strip())
    if q.strip():
        keyword = q.strip()
        query = query.join(User).where(
            or_(
                Post.title.contains(keyword, autoescape=True),
                Post.content.contains(keyword, autoescape=True),
                User.nickname.contains(keyword, autoescape=True),
                User.address.contains(keyword.lower(), autoescape=True),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    posts = db.scalars(
        query.options(selectinload(Post.author))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    counts = count_comments(db, [post.id for post in posts])
    return PostListOut(
        items=[summary_of(post, counts.get(post.id, 0)) for post in posts], total=total
    )


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    post = Post(
        title=payload.title,
        topic=payload.topic,
        content=payload.content,
        author_id=user.id,
        author=user,
    )
    db.add(post)
    db.commit()
    return detail_of(post, 0)


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db)) -> PostOut:
    post = find_post(db, post_id)
    return detail_of(post, count_comments(db, [post.id]).get(post.id, 0))


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "帖子不存在或已被删除")
    if post.author_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只能删除自己的帖子")

    # SQLite 默认不打开外键级联，帖子没了，挂在它上面的消息也要显式清掉
    db.execute(delete(Notification).where(Notification.post_id == post_id))
    db.delete(post)
    db.commit()


@router.get("/{post_id}/comments", response_model=CommentListOut)
def list_comments(
    post_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> CommentListOut:
    find_post(db, post_id)
    visible_roots = select(Comment.id).where(
        Comment.post_id == post_id,
        Comment.parent_id.is_(None),
        VISIBLE_COMMENT,
    )
    root_total = db.scalar(select(func.count()).select_from(visible_roots.subquery())) or 0
    visible_replies = select(Comment.id).where(
        Comment.post_id == post_id,
        Comment.depth == 2,
        Comment.parent_id.in_(visible_roots),
        VISIBLE_COMMENT,
    )
    reply_total = db.scalar(select(func.count()).select_from(visible_replies.subquery())) or 0
    visible_nested_replies = select(Comment.id).where(
        Comment.post_id == post_id,
        Comment.depth == 3,
        Comment.parent_id.in_(visible_replies),
        VISIBLE_COMMENT,
    )
    nested_reply_total = (
        db.scalar(select(func.count()).select_from(visible_nested_replies.subquery())) or 0
    )
    total = root_total + reply_total + nested_reply_total
    root_query = select(Comment).where(
        Comment.post_id == post_id,
        Comment.parent_id.is_(None),
        VISIBLE_COMMENT,
    )
    roots = db.scalars(
        root_query.options(selectinload(Comment.author))
        .order_by(Comment.created_at.desc(), Comment.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    # Paginate conversation roots, then fetch their descendants so each returned
    # thread remains complete and replies are never orphaned by page boundaries.
    root_ids = [comment.id for comment in roots]
    replies = db.scalars(
        select(Comment)
        .where(Comment.parent_id.in_(root_ids), VISIBLE_COMMENT)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    reply_ids = [comment.id for comment in replies]
    nested_replies = db.scalars(
        select(Comment)
        .where(Comment.parent_id.in_(reply_ids), VISIBLE_COMMENT)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    comments = roots + replies + nested_replies
    return CommentListOut(
        items=build_tree(comments),
        total=total,
        has_more=offset + len(roots) < root_total,
    )


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentOut:
    post = find_post(db, post_id)

    parent = None
    if payload.parent_id is not None:
        parent = db.get(Comment, payload.parent_id)
        if parent is None or parent.post_id != post_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "要回复的评论不存在")
        if parent.depth >= MAX_COMMENT_DEPTH:
            raise HTTPException(status.HTTP_409_CONFLICT, "评论最多三级，请在已有回复下继续讨论")

    comment = Comment(
        post_id=post_id,
        author_id=user.id,
        author=user,
        parent_id=parent.id if parent else None,
        parent=parent,
        depth=parent.depth + 1 if parent else 1,
        content=payload.content,
    )
    db.add(comment)
    db.flush()  # 先拿到 comment.id，消息行和评论落在同一个事务里

    # 一级评论提醒帖子作者，回复提醒被回复的人；自己回复自己不产生消息
    recipient_id = post.author_id if parent is None else parent.author_id
    if recipient_id != user.id:
        db.add(
            Notification(
                user_id=recipient_id,
                actor_id=user.id,
                post_id=post_id,
                comment_id=comment.id,
                kind="post_comment" if parent is None else "comment_reply",
            )
        )

    db.commit()
    return CommentOut(
        id=comment.id,
        content=comment.content,
        depth=comment.depth,
        created_at=comment.created_at,
        author=UserBrief.model_validate(user),
    )


@router.delete("/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    post_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    comment = db.get(Comment, comment_id)
    if comment is None or comment.post_id != post_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "评论不存在或已被删除")
    if comment.author_id != user.id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只能删除自己的评论")

    # 删掉一级评论时，其下的回复由级联一起删除；消息同样要按整棵子树清理，
    # 否则留下的消息会指向已经不存在的评论，取摘要时直接报错
    doomed = {comment.id}
    frontier = [comment]
    while frontier:
        for reply in frontier.pop().replies:
            doomed.add(reply.id)
            frontier.append(reply)
    db.execute(delete(Notification).where(Notification.comment_id.in_(doomed)))

    db.delete(comment)
    db.commit()
