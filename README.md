# BUPT3DAO 官网

北京邮电大学区块链协会（BUPT3DAO）社区官网。**没有账号密码**——用钱包签名（SIWE / EIP-4361）证明身份，首次登录自动建号。

线上地址：<https://bupt3dao.club>
官方推特：[@BUPT3DAO](https://x.com/BUPT3DAO)

## 功能

| 模块 | 说明 |
| --- | --- |
| 钱包登录 | 弹窗选择浏览器插件钱包（MetaMask / OKX / Bitget / TokenPocket / Rabby 等），通过 EIP-6963 自动发现。后端按 EIP-4361 校验签名，不落库任何密码或私钥。 |
| 社区论坛 | 板块分类（技术交流 / 项目共建 / 校园日常）、Markdown 发帖、三级嵌套评论。 |
| 消息提示 | 有人回复你的帖子或评论时收到站内消息，未读数显示在侧边栏，点开即已读并跳到对应帖子。 |
| 文章 | Markdown 长文发布与编辑、置顶、手动排序。 |
| 个人主页 | 昵称、头像、主页背景图、入学年份、学院、专业、学校、个人链接。 |
| 成员风采 | 由管理员挑选并维护的成员展示位，展示介绍支持 Markdown。 |
| 首页公告 | 首页首屏最上方展示公告，内容支持 Markdown（标题、列表、链接、加粗）；管理员可在后台「站点设置」随时编辑，清空即撤下。未设置时公告条不显示，首屏维持原来的排版。 |
| 社区群二维码 | 首页首屏右侧展示社区群二维码卡片，管理员可在后台「站点设置」随时更换或移除；未设置时该卡片不显示，首屏维持原来的排版。 |
| 管理后台 | 封禁用户、维护管理员名单、管理帖子、维护成员风采、文章置顶与排序、编辑首页公告、更换首页社区群二维码。 |

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Next.js 15（App Router）、React 19、TypeScript、`output: 'standalone'` |
| 钱包 | RainbowKit 2 + wagmi 2 + viem |
| 后端 | FastAPI、SQLAlchemy 2、Pydantic v2 |
| 数据库 | SQLite（默认，单文件）；可通过 `DATABASE_URL` 换成 Postgres |
| 认证 | SIWE / EIP-4361（eth-account 做签名恢复）+ JWT（HS256） |
| 部署 | Docker Compose + Caddy 网关，蓝绿发布 |
| 流水线 | GitHub Actions + GHCR |

## 目录结构

```
.
├── apps/
│   ├── web/                  # Next.js 前端
│   │   ├── src/app/          # App Router 页面 + /api、/uploads 两个代理路由
│   │   ├── src/components/   # UI 组件（含 web3-providers、wallet-provider）
│   │   └── src/lib/          # API 客户端、请求转发
│   └── api/                  # FastAPI 后端
│       ├── app/routers/      # auth / posts / notifications / users / members / articles / site / admin
│       ├── app/models.py     # SQLAlchemy 数据模型
│       ├── app/siwe.py       # EIP-4361 消息构造与签名校验
│       └── tests/            # pytest 用例
├── docker/                   # Compose、Caddy 配置、部署脚本
├── docs/                     # 开发者文档
├── .github/workflows/        # ci.yml（检查）、release.yml（部署）
├── package.json              # 根级脚本入口
└── pnpm-workspace.yaml       # workspace 定义
```

## 本地开发

前置：Node 22（见 `.nvmrc`）、pnpm 10.29.2、Python 3.12。

```bash
pnpm install
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r apps/api/requirements-dev.txt
cp apps/api/.env.example .env     # 见下方说明，放在仓库根
```

> 后端配置（`.env`、`sqlite:///./data/app.db`）都是**相对进程工作目录**解析的。`pnpm dev:api` 在仓库根执行，所以 `.env` 放仓库根、数据库落在 `<仓库根>/data/app.db`。若改为在 `apps/api` 目录里直接跑 uvicorn，则对应 `apps/api/.env` 与 `apps/api/data/app.db`。

启动后端与前端（两个终端）：

```bash
pnpm dev:api                        # http://localhost:8000
pnpm dev:web                        # http://localhost:3000
```

浏览器打开 <http://localhost:3000>。

> 钱包登录要求安全上下文。用 `localhost` 可以正常跑；换成局域网 IP 或普通 HTTP 域名时浏览器不暴露钱包注入对象，页面会提示需要 HTTPS。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev:web` / `pnpm dev:api` | 启动前端 / 后端开发服务 |
| `pnpm build:web` | 构建前端 |
| `pnpm lint:web` / `pnpm typecheck:web` | 前端 ESLint / TypeScript 检查 |
| `pnpm lint:api` / `pnpm format:api` | 后端 ruff 检查 / 格式化 |
| `pnpm test:api` | 后端 pytest |
| `pnpm docker:up` / `pnpm docker:down` | 本地起 / 停整套 Compose |

## 部署

推送或合并到 `main` 即自动跑检查、构建镜像、蓝绿发布到 <https://bupt3dao.club>，无需人工操作。

- 流水线细节：[docs/ci-cd.md](docs/ci-cd.md)
- 服务器配置与运维：[docs/deployment.md](docs/deployment.md)

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | 项目架构：模块划分、请求链路、数据模型、认证时序 |
| [docs/ci-cd.md](docs/ci-cd.md) | GitHub Actions：CI 检查项、镜像构建、部署与回滚 |
| [docs/deployment.md](docs/deployment.md) | 服务器目录布局、`.env` 配置、蓝绿切换、备份与排障 |
| [docs/api.md](docs/api.md) | 后端接口清单与认证方式 |
| [docs/development.md](docs/development.md) | 本地开发流程、代码规范、依赖升级注意事项 |

## 贡献

1. 从 `main` 切出功能分支。
2. 提交信息用中文，遵循 `feat:` / `fix:` / `chore:` / `docs:` 前缀。
3. 提 PR，CI（前端 lint + 类型检查 + 构建、后端 ruff + pytest）必须全绿。
4. 评审通过后合并到 `main`，自动部署。

升级依赖前请先读 [docs/development.md](docs/development.md#依赖升级注意事项)，其中记录了若干**不能随手升级**的包。
