#!/usr/bin/env bash
# Checks ZUGFeRD / Factur-X hybrid PDFs with the Mustang validator: the PDF
# as PDF/A-3 (veraPDF inside Mustang) and the embedded XML against EN 16931
# and XRechnung. Runs in a throwaway Java container — the backend image has
# no Java. Writes the hybrid from the ZUGFeRD unit test when no files are given.
#
#   scripts/validate-zugferd.sh [file.pdf ...]
#
# Needs docker. Downloads the Mustang CLI once into
# ${XDG_CACHE_HOME:-~/.cache}/seneca-kosit.
set -euo pipefail

MUSTANG_VERSION=2.26.0
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/seneca-kosit"

mkdir -p "$CACHE"
if [ ! -f "$CACHE/mustang-${MUSTANG_VERSION}.jar" ]; then
  curl -sSL -o "$CACHE/mustang-${MUSTANG_VERSION}.jar" \
    "https://github.com/ZUGFeRD/mustangproject/releases/download/core-${MUSTANG_VERSION}/Mustang-CLI-${MUSTANG_VERSION}.jar"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/in"

if [ "$#" -gt 0 ]; then
  cp "$@" "$WORK/in/"
else
  docker exec finflow-backend sh -c 'cd /app && rm -rf /tmp/zugferd-out && XRECHNUNG_OUT=/tmp/zugferd-out npx jest --config jest.unit.config.ts @tests/unit/modules/e-invoices/zugferd >/dev/null'
  docker cp finflow-backend:/tmp/zugferd-out/. "$WORK/in/"
fi

cp "$CACHE/mustang-${MUSTANG_VERSION}.jar" "$WORK/mustang.jar"
status=0
for file in "$WORK"/in/*.pdf; do
  name="$(basename "$file")"
  result="$(docker run --rm -v "$WORK":/w -w /w eclipse-temurin:21-jre \
    java -Xmx1g -jar mustang.jar --action validate --source "in/$name" --no-notices 2>&1)"
  if grep -q 'Parsed PDF:valid XML:valid' <<<"$result"; then
    echo "valid    $name"
  else
    echo "INVALID  $name"
    sed -n '/<validation/,/<\/validation>/p' <<<"$result"
    status=1
  fi
done
exit "$status"
