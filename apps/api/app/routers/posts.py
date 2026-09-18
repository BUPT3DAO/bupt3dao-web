"""帖子：信息流、发帖、删帖。"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Post, User
from app.schemas import PostCreate, PostListOut, PostOut
from app.security import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("", response_model=PostListOut)
def list_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> PostListOut:
    total = db.scalar(select(func.count()).select_from(Post)) or 0
    posts = db.scalars(
        select(Post)
        .options(selectinload(Post.author))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return PostListOut(items=[PostOut.model_validate(post) for post in posts], total=total)


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    post = Post(content=payload.content, author_id=user.id, author=user)
    db.add(post)
    db.commit()
    return PostOut.model_validate(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    post = db.get(Post, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "帖子不存在或已被删除")
    if post.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "只能删除自己的帖子")

    db.delete(post)
    db.commit()
