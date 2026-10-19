#!/usr/bin/env bash
# Checks XRechnung files with KoSIT's official validator (XRechnung 3.0.2
# configuration), run in a throwaway Java container — the backend image has
# no Java. Writes the files from the writer's unit test and the issuing e2e
# when no files are given.
#
#   scripts/validate-xrechnung.sh [file.xml ...]
#
# Needs docker. Downloads the validator and its configuration once into
# ${XDG_CACHE_HOME:-~/.cache}/seneca-kosit.
set -euo pipefail

VALIDATOR_VERSION=1.6.3
CONFIG_RELEASE=v2026-08-31
CONFIG_ASSET=xrechnung-3.0.2-validator-configuration-2026-08-31.zip
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/seneca-kosit"

mkdir -p "$CACHE"
if [ ! -f "$CACHE/validator.jar" ]; then
  curl -sSL -o "$CACHE/validator.jar" \
    "https://github.com/itplr-kosit/validator/releases/download/v${VALIDATOR_VERSION}/validator-${VALIDATOR_VERSION}-standalone.jar"
fi
if [ ! -f "$CACHE/config/scenarios.xml" ]; then
  curl -sSL -o "$CACHE/config.zip" \
    "https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/${CONFIG_RELEASE}/${CONFIG_ASSET}"
  unzip -o -q "$CACHE/config.zip" -d "$CACHE/config"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/in" "$WORK/out"

if [ "$#" -gt 0 ]; then
  cp "$@" "$WORK/in/"
else
  # The writer's scenarios, generated inside the dev backend container.
  docker exec finflow-backend sh -c 'cd /app && rm -rf /tmp/xrechnung-out && XRECHNUNG_OUT=/tmp/xrechnung-out npx jest --config jest.unit.config.ts @tests/unit/modules/e-invoices/xrechnung-writer >/dev/null'
  docker cp finflow-backend:/tmp/xrechnung-out/. "$WORK/in/"
fi

cp "$CACHE/validator.jar" "$WORK/"
cp -r "$CACHE/config" "$WORK/"
# The glob is the container's, not this shell's.
docker run --rm -v "$WORK":/w -w /w eclipse-temurin:21-jre \
  sh -c 'java -jar validator.jar -s config/scenarios.xml -r config -o out in/*.xml'
