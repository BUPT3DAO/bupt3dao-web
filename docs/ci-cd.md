# CI / CD 流水线

## 概览

仓库只有两个 workflow：

| 文件 | 名称 | 触发 | 作用 |
| --- | --- | --- | --- |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | CI | `pull_request`、被其他 workflow 调用（`workflow_call`） | 前端依赖审计 / lint / 类型检查 / 构建，后端生产依赖审计 / ruff / pytest |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | Deploy Main | push 到 `main`、手动 `workflow_dispatch` | 复跑 CI → 构建并推送镜像 → 部署到服务器 → 验证公网入口 |

CI 与部署共用同一份检查逻辑：`release.yml` 的 `checks` job 通过 `uses: ./.github/workflows/ci.yml` 复用，**检查不过就不会构建镜像，更不会部署**。

## CI（ci.yml）

- 触发：任何 PR，以及被 `release.yml` 调用。
- 并发：`group: ci-${{ github.ref }}`，`cancel-in-progress: true`。同一分支有新提交时，旧的一次立即取消。
- 权限：只读（`contents: read`）。

两个 job 并行跑：

**`web` —— lint + typecheck + build**（超时 15 分钟）

1. `actions/checkout@v7`
2. `pnpm/action-setup@v6`（版本取自根 `package.json` 的 `packageManager: pnpm@10.29.2`）
3. `actions/setup-node@v7`，Node 版本读 `.nvmrc`（当前 `22`），并开启 pnpm store 缓存
4. `pnpm install --frozen-lockfile` —— 锁文件与 `package.json` 不一致会直接失败
5. `pnpm audit --prod --audit-level=low` —— 生产依赖存在 low 或更高等级公告时阻止检查通过
6. `pnpm --filter web lint`（ESLint）
7. `pnpm --filter web typecheck`（`tsc --noEmit`）
8. `pnpm --filter web build`

**`api` —— ruff + pytest**（超时 10 分钟，工作目录 `apps/api`）

1. `actions/checkout@v7`
2. `actions/setup-python@v7`，Python 3.12，缓存依赖 `apps/api/requirements-dev.txt`
3. `pip install -r requirements-dev.txt`
4. `pypa/gh-action-pip-audit@v1.1.0` 审计仓库路径 `apps/api/requirements.txt` 中的生产依赖
5. `ruff check .`
6. `ruff format --check .` —— 格式不达标会失败，本地先跑 `pnpm format:api`
7. `pytest`

## CD（release.yml）

### 触发与并发

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

- 并发组 `deploy-main`，`cancel-in-progress: false` —— 部署**串行排队**而不是互相取消，避免两次发布交叉改 `upstream.caddy`。
- 权限：`contents: read` + `packages: write`（推送 GHCR 镜像需要）。

### Job 1：`checks`

`uses: ./.github/workflows/ci.yml`，并且用 `if: github.ref == 'refs/heads/main'` 保证手动触发非 main 分支时不执行。

### Job 2：`images`

`needs: checks`，矩阵构建两个镜像：

| app | Dockerfile | 镜像 |
| --- | --- | --- |
| `web` | `apps/web/Dockerfile` | `ghcr.io/bupt3dao/bupt3dao-web/web:sha-<40位提交哈希>` |
| `api` | `apps/api/Dockerfile` | `ghcr.io/bupt3dao/bupt3dao-web/api:sha-<40位提交哈希>` |

- `fail-fast: false`，两个镜像互不阻塞。
- 用 `GITHUB_TOKEN` 登录 GHCR（`username: ${{ github.actor }}`）。
- 标签由 `docker/metadata-action` 的 `type=sha,format=long` 生成，即 **`sha-` + 完整 40 位 commit SHA**。这套标签是后续部署与回滚的基础，不要改成短 SHA。
- **构建上下文是仓库根目录**，因为前端镜像要拿到根级 `pnpm-lock.yaml` 与 `pnpm-workspace.yaml`。本地手动构建时要写 `docker build -f apps/web/Dockerfile .`。
- 用 GHA 缓存（`scope=web` / `scope=api`）加速。

### Job 3：`deploy`

`needs: images`，超时 10 分钟。步骤依次是：

**1. 检查是否仍是 main 最新提交**

```bash
head="$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)"
[[ "$head" == "$GITHUB_SHA" ]] && echo "deploy=true" >> "$GITHUB_OUTPUT"
```

如果排队期间 `main` 又被推了新提交，这次就整体跳过，不做无用发布。**被跳过是正常行为**，此时后续步骤全为灰色。

**2. 配置 SSH 凭据**

从 Secrets 写入 `~/.ssh/id_ed25519` 与 `~/.ssh/known_hosts`，均 `chmod 600`。`known_hosts` 用的是仓库里固定的主机公钥，配合 `StrictHostKeyChecking=yes`，不依赖首次连接时的信任提示。

**3. 上传本次提交的部署文件**

把 `docker/docker-compose.yml`、`docker/deploy.sh`、`docker/caddy/Caddyfile` 三个文件 scp 到 `/opt/bupt3dao/releases/<SHA>/`。

注意 `upstream.caddy` **不在上传列表里**——它是服务器上的运行时状态，由部署脚本自己维护。

**4. 执行部署脚本**

```bash
printf '%s' "$GHCR_TOKEN" | ssh ... "bash /opt/bupt3dao/releases/$GITHUB_SHA/deploy.sh '$GITHUB_SHA' '$GITHUB_ACTOR'"
```

GitHub 的短期 token 通过 stdin 传给服务器，只用于 `docker login ghcr.io`，不写进任何文件。

**5. 验证公网入口**

```bash
curl --fail https://bupt3dao.club/api/health
curl --fail https://bupt3dao.club/
# www 必须 301 到主域
test "$(curl -o /dev/null -w '%{redirect_url}' https://www.bupt3dao.club/)" = "https://bupt3dao.club/"
```

**6. 清理 runner 上的凭据**（`if: always()`，失败也会执行）

### 需要的 Secrets

| 名称 | 说明 |
| --- | --- |
| `DEPLOY_HOST` | 服务器地址 |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_SSH_KEY` | 部署专用私钥（ed25519），对应公钥已写入服务器 `authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | 服务器主机公钥，固定信任，避免 MITM |

`GITHUB_TOKEN` 是 Actions 内置的，不需要手动配置。

## 部署脚本做了什么

[deploy.sh](../docker/deploy.sh) 是实际执行发布的地方，也可以手动跑（见 [deployment.md](deployment.md)）。核心步骤：

1. **加锁**：`flock` 拿 `/opt/bupt3dao/.deploy.lock`，最长等 300 秒，防止 Actions 与手动执行撞车。
2. **登录 GHCR** 并**先 pull 镜像**。拉取失败必须发生在切换之前，否则会把线上搞挂。
3. **写 Caddy 配置**：`Caddyfile` 属于代码，每次覆盖；`upstream.caddy` 属于运行时状态，**只在缺失时补一个**，不能覆盖，否则会把线上颜色重置回 blue。
4. **`caddy validate`** 校验配置语法。
5. **备份数据库**：用 SQLite 的在线备份 API（`sqlite3.Connection.backup`）从**正在运行的旧容器**里导出快照到 `/opt/bupt3dao/backups/<UTC时间>-<旧SHA>.db`。
6. **起新色并等它健康**：先只起 `api-<target>` 和 `web-<target>`，`--wait` 等 healthcheck 通过，再分别探测本机端口的 `/api/health` 和 `/`。此时线上仍由旧色服务。
7. **确保 gateway 在跑**：只在自身定义变化时（例如首次切到蓝绿布局）才重建，平时是空操作。
8. **原子切换**：改写 `upstream.caddy` → `caddy reload`。reload 失败时 Caddy 会保留旧配置继续服务。
9. **带证书校验**：用 `curl --resolve bupt3dao.club:443:127.0.0.1` 直接打本机 443，验证真实域名与证书下的 `/api/health`、`/`，以及 `www` 跳转。
10. **收尾**：停掉并删除旧色容器 → 写 `current-sha` 与 `active-color` → 清理旧镜像（只保留当前与上一个 SHA）→ 删除 14 天前的备份。

### 自动回滚

`deploy.sh` 用 `trap rollback ERR` 覆盖第 3～9 步。任何一步失败会：

1. 把 `upstream.caddy` 改回切换前的值并 `caddy reload` —— **旧色容器全程没动过，切回上游即可恢复服务**；
2. 如果 gateway 本身是新起的（首次从单份布局迁移），改用旧版本定义把它拉回来；
3. 删掉本次新起的那一色容器，以非零码退出。

切换成功后的收尾步骤已 `trap - ERR` 解除保护——新色已经验证通过并接管流量，此时收尾失败不应再把流量切回去。

## 常见问题

**为什么一次 push 会看到两个 workflow？**

`Dependabot Updates` 是 Dependabot 给它的 PR 更新 lockfile 的任务，跑在 `dependabot/*` 分支上，**与线上无关**。它失败通常意味着某个依赖升级后装不上（见 [development.md](development.md#依赖升级注意事项)）。真正部署的是 `Deploy Main`。

**`Deploy Main` 里 deploy job 全灰了？**

大概率是「检查是否仍是 main 最新提交」判定被更新提交取代，主动跳过。看该步骤的日志会打印 `跳过已被更新提交取代的版本 <sha>`。等最新那次跑完即可。

**PR 上 CI 通过但部署失败？**

CI 只做静态检查与构建，不碰服务器。部署失败要看 `deploy.sh` 的日志：`docker compose ps`、`caddy validate`、healthcheck、TLS 校验这几处最容易出问题，通常对应 [deployment.md](deployment.md#排障) 里列的场景。

**手动触发部署**

Actions 页面选 `Deploy Main` → `Run workflow`，选 `main` 分支。`workflow_dispatch` 走的是同一套流程，仍会构建镜像并跑完整发布。
