#!/bin/sh
# Runs `make upgrade` on behalf of the Settings page.
#
# The backend drops the requested release tag into $UPDATE_DIR/request; this
# loop picks it up, backs up the database, pulls the release images and
# recreates the backend and frontend. Progress goes to $UPDATE_DIR/status.json,
# and $UPDATE_DIR/heartbeat tells the backend the updater is running.
set -u

UPDATE_DIR="${UPDATE_DIR:-/update}"
PROJECT_MOUNT="${PROJECT_MOUNT:-/project}"
READY_URL="${READY_URL:-http://backend:3001/api/v1/health/ready}"

self_label() {
  docker inspect "$(hostname)" --format "{{ index .Config.Labels \"$1\" }}"
}

# Compose resolves .env, env_file and bind mounts against the project's path on
# the host, so make that path exist in here too.
HOST_DIR="$(self_label com.docker.compose.project.working_dir)"
PROJECT="$(self_label com.docker.compose.project)"
if [ -z "$HOST_DIR" ] || [ -z "$PROJECT" ]; then
  echo "updater: not started by docker compose, exiting" >&2
  exit 1
fi
if [ ! -e "$HOST_DIR" ]; then
  mkdir -p "$(dirname "$HOST_DIR")"
  ln -s "$PROJECT_MOUNT" "$HOST_DIR"
fi
cd "$HOST_DIR" || exit 1

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

json_escape() { printf '%s' "$1" | tr '\n\r\t' '   ' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

STARTED_AT=""
BACKUP=""
write_status() { # state tag step message finishedAt
  tmp="$UPDATE_DIR/.status.tmp"
  printf '{"state":"%s","tag":"%s","step":"%s","message":"%s","backup":"%s","startedAt":"%s","finishedAt":"%s"}\n' \
    "$1" "$2" "$3" "$(json_escape "$4")" "$BACKUP" "$STARTED_AT" "$5" >"$tmp"
  chmod 644 "$tmp"
  mv "$tmp" "$UPDATE_DIR/status.json"
}

compose() { docker compose -p "$PROJECT" "$@"; }

env_pin() { grep -E '^IMAGE_TAG=' .env 2>/dev/null | tail -n1 | cut -d= -f2; }

run_upgrade() {
  tag="$1"
  STARTED_AT="$(now)"
  BACKUP=""

  # A pinned release stays pinned, so a later `docker compose up` from the
  # host keeps the new version; otherwise follow `latest` like `make upgrade`.
  if [ -n "$(env_pin)" ]; then
    image_tag="$tag"
  else
    image_tag="latest"
  fi

  write_status running "$tag" backup "" ""
  backup="backup_$(date +%Y%m%d_%H%M%S).sql"
  # shellcheck disable=SC2016 # expanded by the postgres container
  if ! compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' >"$backup" 2>"$UPDATE_DIR/last-error"; then
    rm -f "$backup"
    write_status failed "$tag" backup "$(tail -n 3 "$UPDATE_DIR/last-error")" "$(now)"
    return
  fi

  BACKUP="$backup"
  write_status running "$tag" pull "" ""
  if ! IMAGE_TAG="$image_tag" compose pull backend frontend >/dev/null 2>"$UPDATE_DIR/last-error"; then
    write_status failed "$tag" pull "$(tail -n 3 "$UPDATE_DIR/last-error")" "$(now)"
    return
  fi

  if [ -n "$(env_pin)" ]; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env
  fi

  write_status running "$tag" restart "" ""
  if ! IMAGE_TAG="$image_tag" compose up -d --no-build --no-deps backend frontend >/dev/null 2>"$UPDATE_DIR/last-error"; then
    write_status failed "$tag" restart "$(tail -n 3 "$UPDATE_DIR/last-error")" "$(now)"
    return
  fi

  write_status running "$tag" health "" ""
  i=0
  while [ "$i" -lt 300 ]; do
    if wget -q -O /dev/null "$READY_URL" 2>/dev/null; then
      write_status succeeded "$tag" finished "" "$(now)"
      docker image prune -f >/dev/null 2>&1
      return
    fi
    i=$((i + 1))
    sleep 1
  done
  write_status failed "$tag" health "Backend not ready after 5 minutes: docker logs finflow-backend" "$(now)"
}

mkdir -p "$UPDATE_DIR"
# The backend (an unprivileged user) drops requests here; like /tmp, anyone may
# add a file but only its owner (or root, us) may remove it.
chmod 1777 "$UPDATE_DIR"
[ -f "$UPDATE_DIR/status.json" ] || write_status idle "" "" "" ""
echo "updater: watching $UPDATE_DIR for project $PROJECT in $HOST_DIR"

while true; do
  touch "$UPDATE_DIR/heartbeat"
  if [ -f "$UPDATE_DIR/request" ]; then
    tag="$(head -c 64 "$UPDATE_DIR/request" | tr -d '[:space:]')"
    rm -f "$UPDATE_DIR/request"
    if printf '%s' "$tag" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
      echo "updater: upgrading to $tag"
      run_upgrade "$tag"
    else
      STARTED_AT="$(now)"
      BACKUP=""
      write_status failed "" request "Rejected tag: $tag" "$(now)"
    fi
  fi
  sleep 3
done
