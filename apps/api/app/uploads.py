"""图片上传：校验 Content-Type 与大小后落盘到 UPLOAD_DIR。

头像、主页背景图、正文配图与站点二维码共用这一套规则，
避免同一份校验逻辑在多个路由里各写一遍。
"""

import time
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.config import settings

ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _image_content_type(data: bytes) -> str | None:
    """根据文件签名识别支持的图片格式，不能只相信客户端传来的 MIME。"""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def save_image(file: UploadFile, prefix: str, limit: int, label: str) -> str:
    """校验并落盘一张图片，返回可直接访问的同源地址。"""
    extension = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "仅支持 PNG / JPEG / WebP / GIF 格式")

    data = file.file.read(limit + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{label}文件为空")
    if len(data) > limit:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"{label}不能超过 {limit // (1024 * 1024)} MB",
        )
    if _image_content_type(data) != file.content_type:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{label}内容与声明的图片格式不匹配")

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{prefix}-{int(time.time())}-{uuid4().hex[:6]}{extension}"
    (settings.upload_dir / filename).write_bytes(data)
    return f"/uploads/{filename}"


def remove_image(url: str | None) -> None:
    """删掉上一张图片，避免上传目录无限增长。"""
    if not url:
        return
    filename = Path(url).name
    if not filename:
        return
    try:
        (settings.upload_dir / filename).unlink(missing_ok=True)
    except OSError:
        # 旧文件删不掉不影响本次上传
        pass
