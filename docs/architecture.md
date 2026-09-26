# 项目架构

## 总览

整个项目是一个 pnpm monorepo，只包含两个可部署单元：

| 单元 | 位置 | 技术 | 对外形态 |
| --- | --- | --- | --- |
| 前端 | `apps/web` | Next.js 15 App Router | 页面 + 两个服务端代理路由 |
| 后端 | `apps/api` | FastAPI | `/api/*` JSON 接口 + `/uploads/*` 静态文件 |

`pnpm-workspace.yaml` 只声明了 `apps/web`。后端不走 pnpm，用 pip 安装 `apps/api/requirements.txt`，因此根 `package.json` 里的后端脚本（`dev:api`、`lint:api`、`test:api`）实际是 `python -m ...` 的快捷方式，仅为了方便在仓库根执行。

## 请求链路

线上只有 Caddy 网关监听 80 / 443，浏览器不会直接访问 Next.js 容器：

```
浏览器
  └─ https://bupt3dao.club            → Caddy gateway
        ├─ 非 /api、/uploads 的请求    → web-blue / web-green (Next.js :3000)
        │     └─ /api/*、/uploads/*    → Next Route Handler 用 fetch 转发
        │           └─ API_PROXY_TARGET → api-blue / api-green (FastAPI :8000)
        └─ www.bupt3dao.club、http://154.51.61.121 → 301 跳正式域名
```

两个关键设计：

**1. 同源代理，前端不感知后端地址。**
浏览器永远只请求本站的 `/api` 和 `/uploads`：

- [api 代理路由](../apps/web/src/app/api/%5B...path%5D/route.ts) 把所有 `/api/*` 交给 `proxyToApi`
- [apps/web/src/lib/proxy.ts](../apps/web/src/lib/proxy.ts) 在**运行期**读取 `API_PROXY_TARGET` 环境变量并转发

因此构建产物里不绑定后端地址，一份镜像可以在任意环境跑，也不存在跨域问题。转发时会剔除 `host`、`accept-encoding` 请求头，以及 `content-length`、`transfer-encoding`、`content-encoding` 等转发后不再成立的响应头。

**2. 蓝绿发布由 Caddy 换上游完成。**
`docker/caddy/Caddyfile` 里用 `import /etc/caddy/upstream.caddy` 引入上游定义，部署脚本只改写 `upstream.caddy` 再 `caddy reload`，gateway 容器不重建、监听不断。详见 [ci-cd.md](ci-cd.md) 与 [deployment.md](deployment.md)。

## 前端结构

### 路由

| 路径 | 页面 |
| --- | --- |
| `/` | 首页 |
| `/forum`、`/forum/[id]` | 论坛列表（板块筛选 + 分页）、帖子详情与评论 |
| `/articles`、`/articles/[id]` | 文章列表、文章详情 |
| `/articles/new`、`/articles/[id]/edit` | 新建 / 编辑文章 |
| `/members` | 成员风采 |
| `/notifications` | 消息提示（谁回复了你的帖子 / 评论，登录后可见） |
| `/u/[address]` | 用户公开主页（按钱包地址） |
| `/settings` | 个人资料设置 |
| `/guide` | 新手指引 |
| `/admin` | 管理后台（仅管理员可见） |

### Provider 嵌套

[layout.tsx](../apps/web/src/app/layout.tsx) 的层级顺序是有意安排的，改动前请确认依赖关系：

```
ThemeProvider           主题，写入 html[data-theme]
└─ WalletProvider       轻量登录态与 API 用户信息
   ├─ Header + main
   └─ (按需) WalletRuntime
      └─ Web3Providers  WagmiProvider + QueryClientProvider + RainbowKitProvider
```

- **ThemeProvider** 在 `<head>` 里内联一段脚本，在首屏绘制前就把 `html[data-theme]` 设好，避免暗色模式闪白；偏好存在 `localStorage` 的 `bupt3dao.theme`。
- **WalletProvider** 对外暴露 `useWallet()`，是业务层唯一的登录态来源；普通访客只加载这一层轻量上下文。
- 用户点击连接钱包，或恢复已有登录态后，才动态加载 [wallet-runtime.tsx](../apps/web/src/components/wallet-runtime.tsx) 与 Web3 SDK。**Web3Providers**（[web3-providers.tsx](../apps/web/src/components/web3-providers.tsx)）只负责钱包连接本身，不含业务逻辑；它通过 `MutationObserver` 监听 `html[data-theme]`，让 RainbowKit 弹窗跟随站点亮暗色。

### 登录态与 API 客户端

- `useWallet()` 返回 `{ status, address, user, error, connect, logout, applyUser }`，`status` 为 `loading | anonymous | connecting | authenticated`。这个接口被 header、发帖框、设置页等多处依赖，改动需要全量回归。
- [lib/api.ts](../apps/web/src/lib/api.ts) 是浏览器侧的 API 客户端，自动从 `localStorage`（键 `bupt3dao.token`）读 JWT 并加 `Authorization: Bearer`。
- `WalletProvider` 监听该 token 的跨标签页变更：另一标签登出时同步清理用户态，token 更换时重新向 `/auth/me` 确认身份，防止 UI 用户和请求 token 不一致。
- 组件不直接 `fetch` 后端，统一走 `api.*` 方法。

### 钱包弹窗只接插件钱包

项目没有配置 WalletConnect，也不打算在校内活动中让同学扫码。为了不让未安装插件的用户被引导去扫码，[web3-providers.tsx](../apps/web/src/components/web3-providers.tsx) 用 `injectedOnly()` 把钱包的 `installed` 强制转成布尔值：环境里没检测到该插件时值为 `false`，RainbowKit 会改走「去安装」引导，不发起连接。

## 后端结构

```
apps/api/app/
├── main.py        应用装配：建表、挂载 /uploads、注册 /api 路由
├── config.py      Pydantic Settings，全部配置来自环境变量
├── db.py          引擎与会话
├── models.py      SQLAlchemy 模型
├── schemas.py     Pydantic 出入参
├── security.py    JWT 签发/校验、当前用户、管理员依赖
├── siwe.py        EIP-4361 消息构造、解析、签名校验、nonce 存储
├── migrations.py  建表与轻量补列
├── uploads.py     图片校验与落盘（头像、背景图、正文配图、站点二维码共用）
└── routers/       auth / posts / notifications / users / members / articles / site / admin
```

所有业务路由挂在一个 `prefix="/api"` 的 APIRouter 下（[main.py](../apps/api/app/main.py)），因此对外路径统一是 `/api/...`。健康检查为 `GET /api/health`：执行数据库 `SELECT 1` 成功时返回 `{"status": "ok"}`，数据库不可用时返回 503，避免部署探针把无法服务请求的 API 误判为健康；公开响应不包含部署环境名称。

站内消息由 [posts.py](../apps/api/app/routers/posts.py) 在落评论时顺手写入，[notifications.py](../apps/api/app/routers/notifications.py) 只负责读取与标记已读：一级评论发给帖子作者，回复发给被回复的人，自己回复自己不产生消息。

站点级公开配置（首页公告与社区群二维码）由 [site.py](../apps/api/app/routers/site.py) 提供只读的 `GET /api/site`，管理员通过 `routers/admin.py` 里的 `/admin/site/announcement` 更新公告、`/admin/site/qrcode` 上传或移除二维码。首页首屏由客户端组件在挂载后拉取该配置：[home-announcement.tsx](../apps/web/src/components/home-announcement.tsx) 把 `announcement` 按 Markdown 渲染成顶部的公告条，[home-group-qrcode.tsx](../apps/web/src/components/home-group-qrcode.tsx) 在 `group_qrcode_url` 有值时把首屏变成「文案 + 二维码卡片」两栏并隐藏装饰圆环。两个字段都为空时首屏维持原来的单栏排版，公告条存在时文案整体下移。

### 鉴权依赖链

[security.py](../apps/api/app/security.py) 定义三层依赖，路由按需引用：

```
get_current_user   Bearer JWT → User；未登录/失效/已封禁分别 401、401、403
      ├─ get_admin  user.is_admin 才通过，否则 403
      └─ ensure_active  被单独用于登录与取用户信息的路径
```

管理员的判定是**两个来源取并集**（[models.py](../apps/api/app/models.py) 的 `User.is_admin`）：

- `ADMIN_ADDRESSES` 环境变量——由部署配置授权，写死在服务器上；
- `admin_users` 表中的记录——由后台添加。

这样普通用户无法通过编辑资料给自己提权。

`routers/admin.py` 在 `APIRouter` 上直接挂了 `dependencies=[Depends(get_admin)]`，整个后台路由组自动受保护。

### 配置项

全部配置集中在 [config.py](../apps/api/app/config.py)，字段名即环境变量名（大小写不敏感）。部署侧见 [deployment.md](deployment.md)。

注意 `UPLOAD_DIR` 与 `MAX_AVATAR_BYTES` 一类带默认值的字段在 `docker-compose.yml` 里被显式覆盖，改动时两边要保持一致。

## 数据模型

单库 SQLite（默认 `sqlite:////data/app.db`），表结构见 [models.py](../apps/api/app/models.py)：

| 表 | 用途 | 关键约束 |
| --- | --- | --- |
| `users` | 用户 | `address` 唯一且索引；`created_at + id` 复合索引支持后台用户分页排序；钱包地址即身份，统一小写存储 |
| `posts` | 论坛帖子 | `topic + created_at + id` 支持板块时间线；`author_id + created_at + id` 支持个人主页帖子分页；`author_id` 级联删除 |
| `comments` | 帖子评论 | `post_id + parent_id + created_at + id` 复合索引支持评论树读取；`parent_id` 自引用，`depth` 最多 3 级（`MAX_COMMENT_DEPTH`） |
| `articles` | Markdown 文章 | `is_pinned` 建索引；置顶按 `sort_order`，其余按发布时间倒序 |
| `notifications` | 站内消息 | `user_id + created_at + id` 支持消息时间线，`user_id + is_read` 支持未读计数；`actor_id` 触发人、`post_id` + `comment_id` + `kind` |
| `profile_details` | 资料扩展 | 主键即 `user_id`；入学年份、学院、专业、学校、个人链接（JSON，最多 5 条） |
| `user_moderation` | 封禁状态 | 主键即 `user_id` |
| `featured_members` | 成员风采 | 主键即 `user_id`，带 `sort_order` |
| `admin_users` | 后台添加的管理员 | 主键即 `address`，按地址与 `users` 关联 |
| `site_config` | 站点级配置 | 单行表，固定主键 `SITE_CONFIG_ID = 1`；放首页公告正文（Markdown）与社区群二维码地址 |

设计上刻意把**新增能力放进独立表**（`profile_details`、`user_moderation`、`featured_members`），这样老库不需要破坏性迁移。`User` 上有一批 `@property`（`cohort`、`school`、`links` 等）把扩展资料摊平，让 `/auth/me` 和公开主页复用同一套输出模型。

`User.detail` 与 `User.admin_entry` 用 `lazy="joined"` 预加载，避免列表页 N+1 查询。

### 迁移策略

目前**没有引入 Alembic**。[migrations.py](../apps/api/app/migrations.py) 采用轻量、幂等的启动迁移，每次进程启动都会执行：

1. `Base.metadata.create_all` —— 建缺失的新表；
2. `_add_missing_columns` —— 对已有表用 `ALTER TABLE ADD COLUMN` 补新列，数据不动；
3. `_backfill` —— 历史数据一次性修正（两位年份届别补成四位、早期无标题帖子补标题）。

此外启动时会检查并补建后台用户排序、帖子列表/作者时间线、评论线程、文章置顶顺序、通知时间线与未读状态的复合索引；帖子新增复合索引后会删除被其前缀覆盖的旧单列索引，减少重复存储与写入开销。`create_all` 不会为已有表自动补新增索引，因此由显式、可重复执行的检查负责旧库升级。

数据模型稳定后应换成 Alembic，新增列时记得同步往 `_LIGHT_COLUMNS` 里登记。

## 认证时序（SIWE / EIP-4361）

前端不生成挑战消息，全部由后端签发并校验，避免两端格式漂移。

```
浏览器                                 后端
  │  POST /api/auth/nonce {address}     │
  │ ───────────────────────────────────▶│  校验地址格式 → 归一化小写
  │                                     │  签发一次性 nonce（TTL 300s）
  │  ◀───────────────────────────────── │  返回 {nonce, message}
  │                                     │
  │  钱包插件对 message 原文签名          │
  │                                     │
  │  POST /api/auth/verify {message, signature}
  │ ───────────────────────────────────▶│  1. 解析 EIP-4361 消息
  │                                     │  2. 读取 nonce（暂不作废）
  │                                     │  3. 校验 nonce / domain / URI / chain / 时间
  │                                     │  4. eth_account 恢复签名地址并比对
  │                                     │  5. 原子比对并作废 nonce
  │                                     │     —— 无效签名不能烧掉挑战，并发重放仅一份通过
  │                                     │  6. 地址首次出现则自动建号
  │  ◀───────────────────────────────── │  返回 {access_token, user}
  │  token 存 localStorage              │
```

实现细节见 [siwe.py](../apps/api/app/siwe.py)：

- 消息按 `SIWE_DOMAIN` / `SIWE_URI` / `SIWE_CHAIN_ID` / `SIWE_STATEMENT` 拼装，`Expiration Time` 为 `NONCE_TTL_SECONDS`（默认 300 秒）。
- `verify_message` 会逐项比对 nonce、域名、URI、版本、链 ID、签发时间与过期时间，最后用 `Account.recover_message(encode_defunct(...))` 恢复地址；签名来自不可信输入，任何解析异常都统一按校验失败处理。校验成功后以原子比较方式消费 nonce，防止伪造签名作废挑战，也防止并发重放。
- 登录挑战保存在数据库 `login_nonces` 表中；未过期的挑战会复用，首次并发申请通过地址唯一约束只保留一个挑战，消费则使用条件删除。因此蓝绿切换、进程重启或多 API 实例不会丢失/重复接受挑战。
- 只依赖 `eth-account` + `eth-utils`，没有引入 web3 全家桶。
- JWT 为 HS256，载荷 `sub` = 小写钱包地址，有效期 `JWT_EXPIRE_MINUTES`（默认 7 天）。

### 前端登录流程

[wallet-provider.tsx](../apps/web/src/components/wallet-provider.tsx) 把「连接钱包」和「SIWE 签名」合成一次用户操作：

1. 点「连接钱包」→ 按需加载钱包 SDK，然后弹 RainbowKit 选择器（`awaitingAccount` 置位）；
2. wagmi 报告账户已连接后，才去调 `/auth/nonce` → 请求签名 → `/auth/verify`；
3. 用 `awaitingAccount` 做闸门，是为了避免页面一刷新就弹签名请求。

已有登录态会按需加载钱包 SDK，以继续监听账户变更；在钱包里切换账户会触发登出（本地 `user.address` 与 wagmi 当前账户不一致时清理登录态）。

## 需要留意的边界

这些是当前架构的已知限制，扩展前请先评估：

- **SQLite 仍是单写**。应用对文件库启用 WAL、正常同步级别与外键约束，蓝绿切换期间读写互相阻塞更少且引用完整性更可靠；它仍不适合作为高并发写入场景的长期数据库，规模增长后应迁移 PostgreSQL。
- **上传文件与数据库同在 `api-data` 卷**（`/data/app.db` + `/data/uploads`），一起备份才是一致快照。
- **`/uploads` 由 FastAPI 的 `StaticFiles` 托管**，Next 侧只做同源转发，不做鉴权——即上传后的图片/头像是公开可读的。
- **公开页面服务端渲染依赖 API 可用性**；服务端公开 GET 数据按 URL 缓存 30 秒，降低重复请求并把内容陈旧窗口限制在 30 秒。冷缓存时 API 不可用仍会降级到客户端请求；非公开页面及带鉴权请求不进入这层缓存。
