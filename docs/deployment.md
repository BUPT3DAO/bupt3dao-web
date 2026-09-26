# 部署与运维手册

## 服务器拓扑

```
                        Internet
                            │  80 / 443
                            ▼
        ┌───────────────────────────────────────┐
        │ gateway  (caddy:2.10.2-alpine)        │
        │ 自动 HTTPS · 读 /etc/caddy/           │
        │ upstream.caddy 决定上游是哪一色        │
        └───────────────┬───────────────────────┘
                        │ 容器网络内转发
        ┌───────────────┴───────────────┐
        ▼                               ▼
   web-blue :3000                  web-green :3000
   （绑 127.0.0.1:3001）            （绑 127.0.0.1:3002）
        │ /api /uploads                 │
        ▼                               ▼
   api-blue :8000                  api-green :8000
        └──────────┬────────────────────┘
                   ▼
            api-data 卷（两色共享）
        /data/app.db + /data/uploads
```

同一时刻**只有一色在对外服务**，另一色要么不存在，要么正在被新版本拉起做健康检查。

`web-blue` / `web-green` 只监听 `127.0.0.1`，外网无法直连；对外只有 gateway 占着 80 / 443。

## 服务器目录布局

固定根目录 `/opt/bupt3dao`（`deploy.sh` 里的 `ROOT`）：

```
/opt/bupt3dao/
├── .env                      # 唯一的环境配置，权限 600（手动维护，CI 不覆盖）
├── .deploy.lock              # flock 用的发布锁
├── current-sha               # 当前线上版本：40 位提交哈希
├── active-color              # 当前在服务的一色：blue 或 green
├── caddy/
│   ├── Caddyfile             # 每次部署从代码覆盖
│   └── upstream.caddy        # 运行时状态，部署脚本改写后 caddy reload
├── releases/
│   └── <完整SHA>/
│       ├── docker-compose.yml
│       ├── deploy.sh
│       └── caddy/Caddyfile
└── backups/
    └── <UTC时间>-<SHA>.db     # 每次发布前的 SQLite 快照，保留 14 天
```

`releases/<SHA>/` 每次部署新建，**不会自动清理**，方便按历史版本回滚。磁盘紧张时手动删除老目录即可。

Docker 命名卷（属于 compose 项目 `bupt3dao-web`）：

| 卷 | 内容 |
| --- | --- |
| `bupt3dao-web_api-data` | **业务数据**：`/data/app.db` 与 `/data/uploads`，两色共享 |
| `bupt3dao-web_caddy-data` | Caddy 的 HTTPS 证书与 ACME 账号，删掉会触发重新签发 |
| `bupt3dao-web_caddy-config` | Caddy 运行时配置 |

> `.env` 里的 `CADDY_DIR` 在服务器上**必须**是 `/opt/bupt3dao/caddy`。不设的话 compose 会退化成 release 目录下的相对路径 `./caddy`，gateway 会挂载到错误的目录。

## 首次准备

1. 服务器装好 Docker Engine 与 Compose v2，`docker compose version` 可用。
2. DNS 把 `bupt3dao.club` 的 A 记录指向服务器 IP，`www` 指到同一台（Caddy 签发证书时会校验域名解析，DNS 未生效会导致 ACME 失败）。
3. 安全组 / 防火墙放通 80、443；3001 / 3002 **不需要**对外。
4. 建目录并写 `.env`：

```bash
sudo mkdir -p /opt/bupt3dao/{caddy,releases,backups}
sudo chmod 700 /opt/bupt3dao
sudo touch /opt/bupt3dao/.env
sudo chmod 600 /opt/bupt3dao/.env
```

5. 把 `docker/.env.example` 的内容按下面的表填进 `/opt/bupt3dao/.env`。
6. 配置 GitHub Actions 的 Secrets（`DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_KNOWN_HOSTS`），把部署公钥写进服务器对应用户的 `~/.ssh/authorized_keys`。

## `.env` 配置

`/opt/bupt3dao/.env` 由 docker compose 读取，是**唯一**的环境配置入口。逐项说明：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | **是** | 登录态 JWT 签名密钥。compose 里写成 `${JWT_SECRET:?请在 .env 中设置 JWT_SECRET}`，缺失会直接启动失败；API 也会在非本地环境拒绝少于 32 个非空白字符的密钥。生成：`openssl rand -hex 32` |
| `PUBLIC_WEB_ORIGIN` | **是** | 对外站点地址，生产固定 `https://bupt3dao.club`。**`deploy.sh` 会断言这个值等于 `https://bupt3dao.club`**，写成别的会导致部署中途报错回滚 |
| `SIWE_DOMAIN` | **是** | 用户签名时展示的域名，必须与用户实际访问的站点一致，生产为 `bupt3dao.club`（不带协议）。不一致会报「签名域名不匹配」 |
| `BLUE_PORT` / `GREEN_PORT` | 建议 | 蓝绿两色绑定的本机端口，默认 `3001` / `3002` |
| `CADDY_DIR` | 建议 | Caddy 配置目录，服务器上填 `/opt/bupt3dao/caddy` |
| `ADMIN_ADDRESSES` | 否 | 管理员钱包地址 JSON 数组，如 `["0xabc..."]`。默认 `[]` 即无人有管理员权限 |
| `ENVIRONMENT` | 否 | 写入 `/api/health` 响应，默认 `production` |
| `TAG` | 否 | 镜像标签。compose 里默认 `latest`，但**部署脚本会显式传 `TAG=sha-<SHA>`**，不要依赖这个默认值 |
| `DATABASE_URL` | 否 | 默认 `sqlite:////data/app.db`（容器内绝对路径，注意是四个斜杠）。可换成 `postgresql+psycopg://user:pass@db:5432/bupt3dao` |

### 由 compose 注入给 API 的环境变量

这些不用写进 `.env`，在 [docker-compose.yml](../docker/docker-compose.yml) 里从上面的变量派生：

| compose 变量 | 取值 |
| --- | --- |
| `CORS_ORIGINS` | `["${PUBLIC_WEB_ORIGIN}"]` |
| `SIWE_URI` | `${PUBLIC_WEB_ORIGIN}` |
| `SIWE_DOMAIN` | `${SIWE_DOMAIN}` |
| `DATABASE_URL` | `${DATABASE_URL:-sqlite:////data/app.db}` |
| `UPLOAD_DIR` | `/data/uploads` |
| `ENVIRONMENT` | `${ENVIRONMENT:-production}` |

> 注意：compose 里 `x-web` 锚点的 `environment` 被 `web-blue` / `web-green` **完整重写**（YAML 锚点合并不深合并 `environment`）。往 web 容器加环境变量时，两个服务都要加。

## 部署

### 自动部署（正常路径）

推送到 `main` 即触发，流程见 [ci-cd.md](ci-cd.md)。你不需要登录服务器。

### 手动部署 / 回滚

`deploy.sh` 可以手动执行。它需要两个参数：目标 SHA 和 GHCR 用户名；同时**要求 stdin 提供 GHCR 的 token**（脚本内部会 `docker login ghcr.io --password-stdin`）。

```bash
# 在服务器上，用历史版本的脚本重新发布（dir 与镜像都还在）
printf '%s' '<GHCR_TOKEN>' | bash /opt/bupt3dao/releases/<SHA>/deploy.sh <SHA> <github用户名>
```

**回滚到上一版本**就是重跑上一版的 `deploy.sh`：`releases/<旧SHA>/` 一直保留，镜像也被刻意保留（见下节），因此这是最可靠的应急手段。

> 镜像清理规则：每次部署结束只保留 `sha-<当前SHA>` 与 `sha-<上一SHA>` 两个标签，更早的会被删除。所以**能直接回滚的只有上一版**，再往前需要重新构建对应提交。

### Caddy 需要重建的情形

`gateway` 平时不会被重建——换上游只是 `caddy reload`。但以下情况会重建 gateway，会有一次极短的中断：

- 首次从「单份 web/api 布局」迁移到蓝绿布局（挂载方式从单文件变成目录）；
- 改动 `gateway` 服务的定义（镜像版本、端口、卷）。

## 查看当前状态

```bash
cat /opt/bupt3dao/current-sha     # 线上跑的是哪个提交
cat /opt/bupt3dao/active-color    # 当前是哪一色
cat /opt/bupt3dao/caddy/upstream.caddy   # Caddy 实际指向（应为 reverse_proxy web-<color>:3000）
```

看容器与日志（`TAG` 与 `-f` 的 release 路径都要对应当前 SHA）：

```bash
cd /opt/bupt3dao
TAG=sha-$(cat current-sha) docker compose --project-name bupt3dao-web \
  --env-file /opt/bupt3dao/.env \
  -f releases/$(cat current-sha)/docker-compose.yml \
  ps

# 跟日志：把 logs 换成 logs -f --tail=200 <服务名>
TAG=sha-$(cat current-sha) docker compose --project-name bupt3dao-web \
  --env-file /opt/bupt3dao/.env \
  -f releases/$(cat current-sha)/docker-compose.yml \
  logs --tail=200 web-$(cat active-color)
```

本机自测（绕过 DNS，直接打本机 443 并校验真实证书）：

```bash
curl --resolve bupt3dao.club:443:127.0.0.1 https://bupt3dao.club/api/health
curl --resolve bupt3dao.club:443:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://bupt3dao.club/
```

## 备份与恢复

### 自动备份

每次发布切换之前，`deploy.sh` 会从**正在运行的旧容器**里用 SQLite 在线备份 API 导出一致快照：

```
/opt/bupt3dao/backups/<UTC时间>-<旧SHA>.db
```

保留 14 天（`find ... -mtime +14 -delete`）。这是**发布前快照**，不是替代异地备份的方案。

### 手工备份

```bash
cd /opt/bupt3dao
TAG=sha-$(cat current-sha) docker compose --project-name bupt3dao-web \
  --env-file /opt/bupt3dao/.env \
  -f releases/$(cat current-sha)/docker-compose.yml \
  exec -T api-$(cat active-color) \
  python -c "import sqlite3; src=sqlite3.connect('/data/app.db'); dst=sqlite3.connect('/backup.db'); src.backup(dst); dst.close(); src.close()"

# 用容器 ID 取文件，不依赖容器命名规则
cid=$(TAG=sha-$(cat current-sha) docker compose --project-name bupt3dao-web \
  --env-file /opt/bupt3dao/.env \
  -f releases/$(cat current-sha)/docker-compose.yml \
  ps -q api-$(cat active-color))
docker cp "$cid:/backup.db" "./app-$(date -u +%Y%m%dT%H%M%SZ).db"
```

> 别直接 `cp` 正在被写入的 `.db` 文件——SQLite 有 WAL，拷贝出来可能不一致。要么用上面的 `backup()` API，要么先停 API 容器。

上传的图片在同一个卷的 `/data/uploads`，备份数据库时记得一并打包。

### 恢复

```bash
# 1. 停掉两色的 api（避免写入）
docker stop <api 容器名>

# 2. 把备份塞回卷里
docker run --rm -v bupt3dao-web_api-data:/data -v /opt/bupt3dao/backups:/backup \
  alpine cp /backup/<备份文件>.db /data/app.db

# 3. 起回来
docker start <api 容器名>
```

## 排障

| 现象 | 排查方向 |
| --- | --- |
| 部署在「TLS 验证」步骤失败 | 该步骤用 `--resolve` 打本机 443。若 DNS 刚改过可能还在传播；也可能是 `PUBLIC_WEB_ORIGIN` 与 `deploy.sh` 断言不一致。Caddy 证书签发失败要看 gateway 日志 |
| 部署在「先 pull 镜像」步骤失败 | GHCR 网络或 token 权限问题。这一步刻意放在切换之前，失败不会影响线上 |
| 站点 502 / 打不开 | `cat active-color` 与 `cat caddy/upstream.caddy` 对一下，确认 Caddy 指向的一色确实在运行；再看该色容器的 healthcheck 状态 |
| 部署后颜色没变 | `upstream.caddy` 只补缺不覆盖，不会重置线上颜色。若怀疑脚本没生效，看 `current-sha` 是否更新 |
| 登录报「签名域名不匹配」 | `.env` 的 `SIWE_DOMAIN` 与浏览器地址栏域名不一致。改了 `.env` 后需要重新部署（compose 重新注入环境变量） |
| 登录报「登录挑战已失效」 | nonce 只有 300 秒有效期（`NONCE_TTL_SECONDS`），签名太慢会过期，重新点一次即可 |
| 容器启动即退出，报 JWT_SECRET 缺失 | `/opt/bupt3dao/.env` 没配 `JWT_SECRET` |
| 磁盘占用增长 | `releases/` 里堆了历史目录；`docker image ls` 看是否有未被清理的 `<none>` 悬空镜像 |
| Caddy 证书反复重新签发 | 检查 `bupt3dao-web_caddy-data` 卷是否被误删 |

## 注意事项

- **改完 `.env` 要重新部署**：环境变量是在容器创建时注入的，不会自动生效。
- **不要手动改 `caddy/upstream.caddy` 后忘记 reload**，改文件本身不影响正在运行的 Caddy。
- **不要直接 `docker compose down`**：会连 gateway 一起停掉，站点直接不可访问。要停某个服务请指定服务名。
- **不要在服务器上改 `releases/<SHA>/` 里的文件**：下次部署会重新 scp 覆盖。
