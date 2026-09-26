# API 接口文档

## 基本信息

- **基地址**：线上通过同源代理访问 `/api`（浏览器只请求本站，由 Next 转发到后端）。本地直连后端是 `http://localhost:8000/api`。
- **数据格式**：请求与响应均为 JSON（上传接口除外，用 `multipart/form-data`）。
- **交互式文档**：后端跑起来后可直接访问 `/docs`（Swagger UI）与 `/redoc`，那里永远是最新的。本文档只做归纳，字段细节以代码 [schemas.py](../apps/api/app/schemas.py) 为准。

## 认证

除登录相关的三个接口外，需要身份的操作统一用 JWT：

```
Authorization: Bearer <access_token>
```

`access_token` 由 `POST /api/auth/verify` 返回，默认有效期 7 天（`JWT_EXPIRE_MINUTES`）。前端把它存在 `localStorage` 的 `bupt3dao.token`，由 [lib/api.ts](../apps/web/src/lib/api.ts) 自动附加。

### 登录流程

**第 1 步：申请挑战**

```http
POST /api/auth/nonce
Content-Type: application/json

{ "address": "0x1234...abcd" }
```

响应：

```json
{
  "nonce": "3f2a...",
  "message": "bupt3dao.club wants you to sign in with your Ethereum account:\n0x1234...\n\n登录 BUPT3DAO 社区\n\nURI: https://bupt3dao.club\nVersion: 1\nChain ID: 1\nNonce: 3f2a...\nIssued At: ...\nExpiration Time: ..."
}
```

`message` 是后端按 EIP-4361 拼好的原文，**必须原样签名**。nonce 一次性、有效期 300 秒（`NONCE_TTL_SECONDS`）。

**第 2 步：签名并换取 token**

用钱包插件对 `message` 签名，然后：

```http
POST /api/auth/verify
Content-Type: application/json

{ "message": "<上一步返回的原文>", "signature": "0x..." }
```

响应：

```json
{ "access_token": "eyJ...", "user": { "address": "0x...", "nickname": "", ... } }
```

**第 3 步（可选）：确认登录态**

```http
GET /api/auth/me
Authorization: Bearer <token>
```

### 鉴权层级

| 标记 | 含义 |
| --- | --- |
| 公开 | 无需任何凭据 |
| 登录 | 需要有效 Bearer token |
| 管理员 | 需要 Bearer token，且地址在 `ADMIN_ADDRESSES` 中或在 `admin_users` 表里 |

### 常见错误码

| 状态码 | 场景 |
| --- | --- |
| 400 | 参数不合法（如地址格式错误）、上传格式不支持 |
| 401 | 未登录、token 过期、签名校验失败 |
| 403 | 无权限（非管理员、账号被封禁、删别人的帖子） |
| 404 | 资源不存在 |
| 413 | 上传文件过大 |
| 422 | Pydantic 请求体校验失败 |

被封禁用户的帖子与评论不会出现在公开列表里（`VISIBLE_POST` / `VISIBLE_COMMENT` 过滤），其文章详情直接返回 404。

## 分页约定

列表接口统一返回：

```json
{ "items": [...], "total": 123 }
```

统一接受 `limit`（`1..100`）与 `offset`（`>= 0`）。

## 系统

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 公开 | 数据库可用时返回 `{"status":"ok","environment":"..."}`；数据库不可用时返回 503，供容器与部署探针识别故障 |

## 站点配置 `site`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/site` | 公开 | 站点级公开配置：`group_qrcode_url`（首页首屏的社区群二维码）与 `announcement`（首页首屏顶部的公告，Markdown 文本）。没配置过时返回 `{"group_qrcode_url": null, "announcement": ""}`，首页据此不渲染对应区块 |

## 认证 `auth`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/nonce` | 公开 | 申请一次性 nonce 与待签名消息。body：`{address}` |
| POST | `/api/auth/verify` | 公开 | 校验签名并签发 JWT；地址首次出现时自动建号。body：`{message, signature}` |
| GET | `/api/auth/me` | 登录 | 取当前登录用户 |

## 帖子与评论 `posts`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/posts` | 公开 | 帖子列表。query：`q`（搜标题 / 正文 / 昵称 / 地址）、`topic`（板块）、`limit`、`offset`。按发布时间倒序 |
| POST | `/api/posts` | 登录 | 发帖。body：`{title, topic, content}` |
| GET | `/api/posts/{post_id}` | 公开 | 帖子详情 |
| DELETE | `/api/posts/{post_id}` | 登录 | 删帖。仅作者本人或管理员 |
| GET | `/api/posts/{post_id}/comments` | 公开 | 评论列表，**已按层级组装成树**返回 |
| POST | `/api/posts/{post_id}/comments` | 登录 | 发表评论 / 回复。body：`{content}` 或 `{content, parent_id}` |
| DELETE | `/api/posts/{post_id}/comments/{comment_id}` | 登录 | 删除评论。仅作者本人或管理员。删一级评论会级联删掉其下回复 |

评论最多三级（`MAX_COMMENT_DEPTH = 3`），超过会返回 400。

发评论会顺带投递站内消息：一级评论提醒帖子作者（`post_comment`），回复提醒被回复的人（`comment_reply`）。自己回复自己不产生消息，被封禁用户的动作也不会提醒任何人。

## 消息提示 `notifications`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/notifications` | 登录 | 自己的消息列表，按时间倒序。query：`limit`、`offset` |
| GET | `/api/notifications/summary` | 登录 | 只取未读数，供侧边栏角标轮询 |
| POST | `/api/notifications/{notification_id}/read` | 登录 | 标记单条已读。别人的消息一律返回 404 |

列表在通用分页结构上多返回一个 `unread`（未读总数），因此前端拉一次列表就能同时刷新角标：

```json
{
  "items": [
    {
      "id": 12,
      "kind": "comment_reply",
      "is_read": false,
      "created_at": "2026-09-18T09:12:33Z",
      "post_id": 7,
      "post_title": "聊聊 SIWE 登录",
      "comment_id": 34,
      "excerpt": "这里还可以再补充一句…",
      "actor": { "address": "0x…", "nickname": "…", "avatar_url": null }
    }
  ],
  "total": 1,
  "unread": 1
}
```

`kind` 取值：`post_comment`（评论了你的帖子）、`comment_reply`（回复了你的评论）。`excerpt` 是回复内容的纯文本摘要，跳转目标为 `/forum/{post_id}`。

消息随帖子、评论一起被清理：删帖清掉该帖全部消息，删一级评论会连同其下回复的消息一起删除。

## 用户与上传 `users`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/users/{address}` | 公开 | 用户公开主页（含帖子数） |
| GET | `/api/users/{address}/posts` | 公开 | 该用户的帖子列表 |
| PATCH | `/api/users/me` | 登录 | 更新资料。body 可含 `nickname`、`bio`、`cohort`、`school`、`major`、`university`、`links`（最多 5 条） |
| POST | `/api/users/me/avatar` | 登录 | 上传头像（`multipart/form-data`，字段名 `file`）。上限 2 MB |
| POST | `/api/users/me/banner` | 登录 | 上传主页背景图。上限 4 MB |
| POST | `/api/users/me/images` | 登录 | 上传正文配图，返回 `{url}` 供写进 Markdown。上限 4 MB |

上传约束：仅接受 **PNG / JPEG / WebP / GIF**，并验证文件签名与请求中的 `Content-Type` 一致，文件落盘到 `UPLOAD_DIR`，返回同源地址 `/uploads/<文件名>`。文件名含完整 UUID，避免并发上传覆盖；通过 Next.js API 代理的请求体上限为 8 MB。成功的图片响应由同源代理设置 7 天缓存，头像与背景图替换时旧文件会被删除，避免目录无限增长。

**`/uploads/*` 不需要鉴权**，任何人拿到文件名都能访问。

## 文章 `articles`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/articles` | 公开 | 文章列表。query：`limit`、`offset`。置顶在前（按 `sort_order`），其余按发布时间倒序 |
| GET | `/api/articles/{article_id}` | 公开 | 文章详情 |
| POST | `/api/articles` | 登录 | 新建文章。body：`{title, content}` |
| PUT | `/api/articles/{article_id}` | 登录 | 编辑文章。仅作者本人或管理员 |
| DELETE | `/api/articles/{article_id}` | 登录 | 删除文章。仅作者本人或管理员 |

## 成员风采 `members`

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/members` | 公开 | 已精选的成员列表。query：`q`（搜昵称 / 头衔 / 届别 / 简介）、`limit`、`offset`。按 `sort_order` 排序 |

未注册或被封禁的成员不会出现在这里。

## 管理后台 `admin`

整个 `/api/admin` 路由组在 `APIRouter` 上就挂了 `Depends(get_admin)`，**所有接口都要求管理员身份**，下表不再重复标注。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/users` | 用户列表。query：`q`、`offset`、`limit`、`featured_only` |
| PATCH | `/api/admin/users/{address}/ban` | 封禁 / 解封。body：`{is_banned, reason}` |
| GET | `/api/admin/admins` | 管理员名单（含来源：配置或后台添加） |
| POST | `/api/admin/admins` | 添加管理员。body：`{address}` |
| DELETE | `/api/admin/admins/{address}` | 移除管理员。**只能移除后台添加的，配置在 `ADMIN_ADDRESSES` 里的移除不了** |
| GET | `/api/admin/posts` | 帖子管理列表。query：`q`、`offset`、`limit` |
| PUT | `/api/admin/members/{address}` | 设为 / 更新成员风采。body：`{title, cohort, introduction, sort_order}`，其中 `introduction` 支持 Markdown（≤ 500 字符），校友墙卡片会渲染成富文本 |
| DELETE | `/api/admin/members/{address}` | 取消成员风采展示 |
| GET | `/api/admin/articles` | 文章管理列表 |
| PATCH | `/api/admin/articles/{article_id}/pin` | 置顶 / 取消置顶。body：`{is_pinned}` |
| POST | `/api/admin/articles/{article_id}/move` | 调整置顶顺序。body：`{direction}`，取值 `up` / `down` |
| POST | `/api/admin/site/qrcode` | 上传 / 更换首页社区群二维码（`multipart/form-data`，字段名 `file`）。上限 4 MB，旧图会被删除 |
| DELETE | `/api/admin/site/qrcode` | 移除首页社区群二维码并删除图片；重复调用保持幂等（204） |
| PUT | `/api/admin/site/announcement` | 更新首页公告。body：`{content}`，Markdown 文本（≤ 5000 字符），首尾空白会被去掉；传空字符串即撤下公告 |

## 调用示例

完整的登录 + 发帖流程：

```bash
API=http://localhost:8000/api
ADDR=0x1234567890abcdef1234567890abcdef12345678

# 1. 取挑战
curl -sS -X POST "$API/auth/nonce" -H 'Content-Type: application/json' \
  -d "{\"address\":\"$ADDR\"}"

# 2. 用钱包插件对返回的 message 签名，然后换取 token
TOKEN=$(curl -sS -X POST "$API/auth/verify" -H 'Content-Type: application/json' \
  -d "{\"message\":\"<原样粘贴 message>\",\"signature\":\"0x<签名>\"}" \
  | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

# 3. 带 token 发帖
curl -sS -X POST "$API/posts" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"第一次参加线下活动","topic":"校园日常","content":"**收获很多**"}'
```

> `message` 里有换行，直接用 JSON 字符串时记得转义成 `\n`。更省事的做法是让前端或脚本从 `/auth/nonce` 的响应里直接取值。
