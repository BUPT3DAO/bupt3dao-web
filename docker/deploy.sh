#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly ROOT=/opt/bupt3dao
readonly SHA="${1:?Commit SHA required}"
readonly ACTOR="${2:?Registry username required}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid commit SHA" >&2; exit 1; }
readonly RELEASE="$ROOT/releases/$SHA"
readonly CADDY_DIR="$ROOT/caddy"
test -f "$ROOT/.env"
test -f "$RELEASE/docker-compose.yml"
test -f "$RELEASE/caddy/Caddyfile"

# Serialize all deployments, including manual retries outside Actions.
exec 9>"$ROOT/.deploy.lock"
flock -w 300 9

export DOCKER_CONFIG
DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
docker login ghcr.io --username "$ACTOR" --password-stdin

read_env() {
  local value
  value="$(sed -n "s/^$1=//p" "$ROOT/.env" | tail -n 1)"
  printf '%s' "${value:-$2}"
}

previous=""
if [[ -f "$ROOT/current-sha" ]]; then
  previous="$(cat "$ROOT/current-sha")"
  [[ "$previous" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid previous SHA" >&2; exit 1; }
fi

active=""
if [[ -f "$ROOT/active-color" ]]; then
  active="$(cat "$ROOT/active-color")"
  [[ "$active" == "blue" || "$active" == "green" ]] || { echo "Invalid active color" >&2; exit 1; }
fi

# 本次发布到当前没有在服务的那一色；首次（还没有 active-color）落在 blue
target=blue
if [[ "$active" == "blue" ]]; then
  target=green
fi
readonly target

# 上一版对外服务的容器：蓝绿改造之前的老布局是单份 web / api
if [[ -n "$active" ]]; then
  old_web="web-$active"
  old_api="api-$active"
else
  old_web=web
  old_api=api
fi

# Caddy 当前的上游，失败时用它把入口切回去
previous_upstream="reverse_proxy web:3000"
if [[ -f "$CADDY_DIR/upstream.caddy" ]]; then
  previous_upstream="$(cat "$CADDY_DIR/upstream.caddy")"
fi

compose() {
  local sha="$1"
  shift
  TAG="sha-$sha" docker compose --project-name bupt3dao-web \
    --env-file "$ROOT/.env" -f "$ROOT/releases/$sha/docker-compose.yml" "$@"
}

port_of() {
  if [[ "$1" == "green" ]]; then
    read_env GREEN_PORT 3002
  else
    read_env BLUE_PORT 3001
  fi
}

write_upstream() {
  local tmp="$CADDY_DIR/upstream.caddy.tmp"
  printf 'reverse_proxy web-%s:3000\n' "$1" > "$tmp"
  mv -f "$tmp" "$CADDY_DIR/upstream.caddy"
}

compose "$SHA" config --quiet
# Pull first: registry or network failures must not interrupt the current site.
compose "$SHA" pull

install -d -m 700 "$CADDY_DIR"
# Caddyfile 属于代码，每次覆盖；upstream.caddy 属于运行时状态，只补缺，否则会把线上颜色重置
install -m 600 "$RELEASE/caddy/Caddyfile" "$CADDY_DIR/Caddyfile"
if [[ ! -f "$CADDY_DIR/upstream.caddy" ]]; then
  write_upstream "$target"
fi
compose "$SHA" run --rm --no-deps gateway caddy validate --config /etc/caddy/Caddyfile

if [[ -n "$previous" ]]; then
  # SQLite's backup API provides a consistent snapshot while the app is running.
  api_id="$(compose "$previous" ps -q "$old_api" 2>/dev/null || true)"
  if [[ -n "$api_id" ]]; then
    docker exec "$api_id" python -c \
      "import sqlite3; src=sqlite3.connect('/data/app.db'); dst=sqlite3.connect('/data/predeploy.db'); src.backup(dst); dst.close(); src.close()"
    docker cp "$api_id:/data/predeploy.db" "$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$previous.db"
  fi
fi

gateway_running() {
  local id
  id="$(compose "$SHA" ps -q gateway 2>/dev/null || true)"
  [[ -n "$id" ]] && [[ "$(docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null)" == "true" ]]
}

rollback() {
  local exit_code="$?"
  trap - ERR
  echo "Deployment failed; switching back to the previous upstream." >&2
  compose "$SHA" ps || true
  # 旧色容器全程没动过，把入口切回去即可恢复服务，然后清掉本次新起的一色
  if gateway_running; then
    printf '%s\n' "$previous_upstream" > "$CADDY_DIR/upstream.caddy.tmp"
    mv -f "$CADDY_DIR/upstream.caddy.tmp" "$CADDY_DIR/upstream.caddy"
    compose "$SHA" exec -T gateway caddy reload --config /etc/caddy/Caddyfile || true
  else
    # 首次从旧布局迁移时 gateway 换了挂载方式要重建，万一新容器起不来，用旧定义把入口拉回来
    compose "$previous" up -d --no-build --wait --wait-timeout 90 gateway || true
  fi
  compose "$SHA" rm -sf "web-$target" "api-$target" || true
  exit "$exit_code"
}
trap rollback ERR

# 先把非活跃色跑起来并等它健康，此时线上仍由旧色对外服务
compose "$SHA" up -d --no-build --wait --wait-timeout 180 "api-$target" "web-$target"
port="$(port_of "$target")"
[[ "$port" =~ ^[0-9]+$ ]]
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/api/health"
curl --fail --silent --show-error --max-time 15 --output /dev/null "http://127.0.0.1:$port/"

# gateway 只在自身定义变化时才重建（例如首次切到蓝绿布局），平时这里是空操作
compose "$SHA" up -d --no-build --wait --wait-timeout 90 gateway

# 原子切换上游：reload 失败时 Caddy 会保留旧配置继续服务
write_upstream "$target"
compose "$SHA" exec -T gateway caddy reload --config /etc/caddy/Caddyfile

# Test TLS against this server while validating the real certificate and hostname.
origin="$(read_env PUBLIC_WEB_ORIGIN '')"
[[ "$origin" == "https://bupt3dao.club" ]]
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors \
  --connect-timeout 5 --max-time 15 --resolve bupt3dao.club:443:127.0.0.1 \
  "$origin/api/health"
curl --fail --silent --show-error --max-time 15 \
  --resolve bupt3dao.club:443:127.0.0.1 --output /dev/null "$origin/"
curl --fail --silent --show-error --retry 6 --retry-delay 5 --retry-all-errors \
  --connect-timeout 5 --max-time 15 \
  --resolve www.bupt3dao.club:443:127.0.0.1 --output /dev/null \
  "https://www.bupt3dao.club/"

# 新色已接管并通过验证，后续收尾失败不应再把流量切回去
trap - ERR

if [[ "$old_web" != "web-$target" ]]; then
  compose "$previous" stop "$old_web" "$old_api" || true
  compose "$previous" rm -f "$old_web" "$old_api" || true
fi

printf '%s\n' "$SHA" > "$ROOT/current-sha.tmp"
mv "$ROOT/current-sha.tmp" "$ROOT/current-sha"
printf '%s\n' "$target" > "$ROOT/active-color.tmp"
mv "$ROOT/active-color.tmp" "$ROOT/active-color"
echo "Deployed $SHA successfully on $target."

# Retain the current and previous images for rollback without growing the small disk.
for image in web api; do
  repository="ghcr.io/bupt3dao/bupt3dao-web/$image"
  while read -r tag; do
    if [[ "$tag" =~ ^sha-[a-f0-9]{40}$ && "$tag" != "sha-$SHA" && "$tag" != "sha-$previous" ]]; then
      docker image rm "$repository:$tag" || true
    fi
  done < <(docker image ls "$repository" --format '{{.Tag}}')
done

# These are pre-deployment snapshots, not a replacement for off-server backups.
find "$ROOT/backups" -maxdepth 1 -type f \
  \( -name '*.db' -o -name '*-uploads.tar.gz' \) -mtime +14 -delete
