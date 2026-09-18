#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly ROOT=/opt/bupt3dao
readonly SHA="${1:?Commit SHA required}"
readonly ACTOR="${2:?Registry username required}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid commit SHA" >&2; exit 1; }
readonly RELEASE="$ROOT/releases/$SHA"
test -f "$ROOT/.env"
test -f "$RELEASE/docker-compose.yml"
test -f "$RELEASE/Caddyfile"

# Serialize all deployments, including manual retries outside Actions.
exec 9>"$ROOT/.deploy.lock"
flock -w 300 9

export DOCKER_CONFIG
DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
docker login ghcr.io --username "$ACTOR" --password-stdin

previous=""
if [[ -f "$ROOT/current-sha" ]]; then
  previous="$(cat "$ROOT/current-sha")"
  [[ "$previous" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid previous SHA" >&2; exit 1; }
fi

compose() {
  local sha="$1"
  shift
  TAG="sha-$sha" docker compose --project-name bupt3dao-web \
    --env-file "$ROOT/.env" -f "$ROOT/releases/$sha/docker-compose.yml" "$@"
}

compose "$SHA" config --quiet
# Pull first: registry or network failures must not interrupt the current site.
compose "$SHA" pull
compose "$SHA" run --rm --no-deps gateway caddy validate --config /etc/caddy/Caddyfile

if [[ -n "$previous" ]]; then
  # SQLite's backup API provides a consistent snapshot while the app is running.
  api_id="$(compose "$previous" ps -q api)"
  if [[ -n "$api_id" ]]; then
    docker exec "$api_id" python -c \
      "import sqlite3; src=sqlite3.connect('/data/app.db'); dst=sqlite3.connect('/data/predeploy.db'); src.backup(dst); dst.close(); src.close()"
    docker cp "$api_id:/data/predeploy.db" "$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$previous.db"
  fi
fi

rollback() {
  local exit_code="$?"
  trap - ERR
  echo "Deployment failed; restoring previous application containers." >&2
  compose "$SHA" ps || true
  if [[ -n "$previous" ]]; then
    compose "$previous" up -d --no-build --wait --wait-timeout 120 || {
      echo "Rollback failed; operator intervention required." >&2
    }
  else
    # Leave named volumes intact even on the first failed deployment.
    compose "$SHA" down || true
  fi
  exit "$exit_code"
}
trap rollback ERR

compose "$SHA" up -d --no-build --wait --wait-timeout 120
port="$(sed -n 's/^WEB_PORT=//p' "$ROOT/.env" | tail -n 1)"
[[ "$port" =~ ^[0-9]+$ ]]
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:$port/api/health"
curl --fail --silent --show-error --max-time 15 --output /dev/null "http://127.0.0.1:$port/"

# Test TLS against this server while validating the real certificate and hostname.
# Caddy may need a short interval to complete the first ACME issuance.
origin="$(sed -n 's/^PUBLIC_WEB_ORIGIN=//p' "$ROOT/.env" | tail -n 1)"
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

printf '%s\n' "$SHA" > "$ROOT/current-sha.tmp"
mv "$ROOT/current-sha.tmp" "$ROOT/current-sha"
trap - ERR
echo "Deployed $SHA successfully."

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
find "$ROOT/backups" -maxdepth 1 -type f -name '*.db' -mtime +14 -delete
