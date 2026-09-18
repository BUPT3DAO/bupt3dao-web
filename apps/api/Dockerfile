# syntax=docker/dockerfile:1
# 构建上下文为仓库根目录：docker build -f apps/api/Dockerfile .

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# ---------- 依赖安装 ----------
FROM base AS builder
COPY apps/api/requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt

# ---------- 运行 ----------
FROM base AS runner
RUN useradd --system --create-home --uid 1001 appuser
COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser apps/api/app ./app

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
