# 本地开发与代码规范

## 环境准备

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node | 22 | 以 `.nvmrc` 为准，CI 也读这个文件 |
| pnpm | 10.29.2 | 由根 `package.json` 的 `packageManager` 字段固定，建议用 `corepack enable` |
| Python | 3.12 | 后端 `pyproject.toml` 要求 `>=3.12` |

```bash
pnpm install

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -r apps/api/requirements-dev.txt   # 已包含 requirements.txt
```

## 配置文件

后端读环境变量，本地开发复制一份示例：

```bash
cp apps/api/.env.example .env
```

> **路径是按进程工作目录解析的。** `env_file=".env"` 与默认的 `sqlite:///./data/app.db` 都相对于启动进程的 CWD。根 `package.json` 的 `pnpm dev:api` 在仓库根执行，所以 `.env` 要放仓库根、数据库落在 `<仓库根>/data/app.db`。
>
> 如果你改为在 `apps/api` 里直接跑 `uvicorn app.main:app --reload`，那 `.env` 放 `apps/api/.env`、库落在 `apps/api/data/app.db`——`.gitignore` 里忽略的是后一种位置。两种跑法不要混用，否则会读到不同的配置和不同的数据库。

前端**不需要**任何本地配置。它请求同源的 `/api`，由 [lib/proxy.ts](../apps/web/src/lib/proxy.ts) 在运行期转发到 `API_PROXY_TARGET`，未设置时默认 `http://localhost:8000`。

想指向别的后端（例如连服务器上的 API 调试）时：

```bash
API_PROXY_TARGET=https://bupt3dao.club pnpm dev:web
```

## 启动

```bash
pnpm dev:api     # uvicorn --reload，http://localhost:8000
pnpm dev:web     # next dev，http://localhost:3000
```

后端起来后 <http://localhost:8000/docs> 有 Swagger UI，可以直接在页面上调试接口。

也可以用 Compose 一次起整套（会走镜像构建，比直接跑 dev server 慢）：

```bash
pnpm docker:up
pnpm docker:down
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev:web` / `pnpm dev:api` | 启动开发服务 |
| `pnpm build:web` | 前端生产构建 |
| `pnpm lint:web` | 前端 ESLint |
| `pnpm typecheck:web` | 前端 `tsc --noEmit` |
| `pnpm lint:api` | 后端 `ruff check apps/api` |
| `pnpm format:api` | 后端 `ruff format apps/api` |
| `pnpm test:api` | 后端 `pytest apps/api` |

**提交前至少跑一遍**：`pnpm lint:web && pnpm typecheck:web && pnpm lint:api && pnpm test:api`。CI 里比这还多一项 `ruff format --check`（只检查不修改），所以本地记得先 `pnpm format:api`。

## 代码规范

### 前端

- TypeScript `strict: true`，路径别名 `@/*` 指向 `apps/web/src/*`。
- ESLint 用 `eslint-config-next`，`pnpm lint:web` 必须零报错。
- 组件按功能分文件放在 `src/components`；页面在 `src/app` 下按 App Router 约定组织。
- 需要浏览器能力的组件（钱包、主题、发帖框）记得标 `'use client'`。
- **不要绕过 [lib/api.ts](../apps/web/src/lib/api.ts) 直接 fetch 后端**。统一走 `api.*`，JWT 与错误处理都在那里。
- 注释与文案用中文，与现有风格保持一致。

### 后端

- ruff 配置见 [pyproject.toml](../apps/api/pyproject.toml)：`line-length = 100`，lint 规则 `E, F, I, UP, B`（忽略 `UP017`）。
- 路由按资源拆到 `app/routers/`，每个模块一个 `APIRouter` 并带 `prefix` 与 `tags`。
- 出入参一律走 `app/schemas.py` 的 Pydantic 模型，不要直接返回 ORM 对象。
- 需要登录的接口用 `Depends(get_current_user)`，管理员接口用 `Depends(get_admin)`。
- 函数与模块用中文 docstring 说明**为什么**这么做，而不是复述代码做了什么。

### 提交信息

中文，带类型前缀，描述改动本身而非过程：

```
feat: 论坛发帖框默认折叠，首页文案调整
fix: 修复设置页残留的 MetaMask 专有文案
docs: 补充 README 与开发者文档
chore: 升级依赖
```

## 测试

后端测试在 `apps/api/tests/`，分模块组织：`test_auth` / `test_posts` / `test_comments` / `test_users` / `test_articles` / `test_admin` / `test_health`。

[conftest.py](../apps/api/tests/conftest.py) 提供了一组夹具，**用临时 SQLite 与临时上传目录，不会污染本地数据**：

| 夹具 | 用途 |
| --- | --- |
| `client` | FastAPI `TestClient`（session 级） |
| `wallet` | 随机生成一个钱包账户 |
| `sign_in` | 传入钱包，走完整 SIWE 流程并拿到 `Authorization` 头 |
| `auth` | 等价于 `sign_in(wallet)`，最常用 |

写新用例时直接用：

```python
def test_something(client, auth):
    response = client.get("/api/posts", headers=auth)
    assert response.status_code == 200
```

> `conftest.py` 里 `os.environ[...]` 的赋值**必须在 `from app.main import app` 之前**——配置对象在模块导入时就读环境变量，顺序反了会读到默认值。新增环境相关用例时注意保持这个结构。

前端目前没有自动化测试，类型检查与构建是主要防线；涉及交互的改动请本地手测。

## 依赖升级注意事项

这几条是踩过坑的，升级前务必确认：

### `wagmi` 必须锁在 2.18.0

`wagmi@2.19.x` 会带出 `@wagmi/connectors@6.2.0` → `@base-org/account@2.4.0` → `@coinbase/cdp-sdk`，而后者 import 了未声明的 `@x402/evm`，导致 `next build` 直接 webpack 报错。

当前 `package.json` 写的是 `"wagmi": "^2.18.0"`，在 npm 语义下 `^` 允许升到 2.19+。**Dependabot 提的 wagmi 升级 PR 一律不要合并**，需要时在 `.github/dependabot.yml` 里给它加 `ignore` 规则。

### Next.js 大版本

Dependabot 会提 Next 16 的升级 PR（连 `eslint-config-next`）。这是 major 升级，涉及 App Router 行为变化，不要顺手合并，应单独开分支验证。

### 其他约束

- `@rainbow-me/rainbowkit` 与 wagmi 版本强耦合，升 RainbowKit 前先确认它支持的 wagmi 范围。
- `pnpm-workspace.yaml` 的 overrides 当前用于将受影响的生产传递依赖锁到公告修复版本；每次升级钱包/Next 依赖后跑 `pnpm audit --prod --audit-level=low`，只有上游依赖链不再解析到受影响版本后，才移除对应 override。
- `.github/dependabot.yml` 已把 minor / patch 归到 `npm-minor-patch`、`pip-minor-patch` 两个分组，减少 PR 噪音。weekly 跑，每组最多 5 个 PR。
- `pnpm install --frozen-lockfile` 是 CI 的固定用法。**改了 `package.json` 一定要把 `pnpm-lock.yaml` 一起提交**，否则 CI 会失败。

## 常见坑

**浏览器里钱包连不上 / 没反应**

浏览器只在安全上下文（HTTPS 或 `localhost`）向页面注入钱包对象。用局域网 IP（如 `http://192.168.x.x:3000`）打开时拿不到任何插件钱包，页面会提示需要 HTTPS。用 `localhost` 或配隧道即可。

**Windows 上 `pnpm build:web` 报 EPERM symlink**

`next.config.mjs` 配了 `output: 'standalone'`，构建收尾阶段要把产物复制成软链结构，Windows 上无管理员权限时可能报 EPERM。**编译本身是通过的**，不影响 CI（跑在 Linux 上）。本地想验证构建结果，用 `pnpm docker:up` 或直接在 WSL 里跑。

**改了后端路由但前端 404**

前端请求走 `/api/*` → Next 代理 → 后端。如果后端路由没挂在 `/api` 前缀下就转发不到；另外确认 `API_PROXY_TARGET` 指向的端口正确。

**数据库改动没生效**

本地 SQLite 文件位置见上一节（取决于你的工作目录）。新增列由 [migrations.py](../apps/api/app/migrations.py) 的 `_LIGHT_COLUMNS` 幂等补齐；如果你改的是列类型或加约束，那套机制不管，删掉本地 `.db` 重建即可（本地数据无所谓，线上别这么干）。

**登录态莫名失效**

JWT 存在 `localStorage`，换个浏览器或清了站点数据就没了。另外后端改了 `JWT_SECRET` 会让所有已签发的 token 立刻失效。

## 加一个新功能要动哪些地方

以「新增一个带鉴权的资源」为例，前后端的改动面：

1. `apps/api/app/models.py` —— 加表；如果是给已有表加列，同步登记到 `migrations.py` 的 `_LIGHT_COLUMNS`。
2. `apps/api/app/schemas.py` —— 入参与出参模型。
3. `apps/api/app/routers/` —— 新建或扩展路由模块，带登录/管理员依赖。
4. `apps/api/app/main.py` —— 新路由模块要 `api.include_router(...)` 注册。
5. `apps/api/tests/` —— 补用例，用 `auth` 夹具拿鉴权头。
6. `apps/web/src/types.ts` —— 对应的 TS 类型。
7. `apps/web/src/lib/api.ts` —— 加一个 `api.xxx()` 方法。
8. `apps/web/src/app/` 与 `src/components/` —— 页面与组件；样式加在 `globals.css`。

改完按上一节跑一遍检查，再推分支提 PR。
