#!/bin/sh
# Prepares the maps volume for tileserver-gl: four OpenMapTiles styles rewired
# to the local tiles, their sprites, and the glyphs they reference.
#
# Safe to re-run: a style is fetched only when its directory is missing, so
# delete styles/<id> (or fonts/) in the volume to refresh it.
set -eu

DATA_DIR=${DATA_DIR:-/data}
CONFIG_SOURCE=${CONFIG_SOURCE:-/scripts/tileserver-config.json}
FONTS_URL=https://github.com/openmaptiles/fonts/releases/download/v2.0/v2.0.zip
# id:repository. The id is what the API exposes and what a user's preference stores.
STYLES="osm-bright:osm-bright-gl-style positron:positron-gl-style dark-matter:dark-matter-gl-style basic:maptiler-basic-gl-style"

if ! command -v jq >/dev/null 2>&1; then
  apk add --no-cache curl jq unzip >/dev/null
fi

mkdir -p "$DATA_DIR/styles" "$DATA_DIR/fonts"
cp "$CONFIG_SOURCE" "$DATA_DIR/config.json"

fetched_style=0
for entry in $STYLES; do
  id=${entry%%:*}
  repo=${entry#*:}
  dir="$DATA_DIR/styles/$id"
  if [ -f "$dir/style.json" ]; then
    continue
  fi

  echo "Fetching style $id"
  mkdir -p "$dir"
  # Built sprites are only published on the repository's GitHub Pages, which
  # tracks master — so style.json comes from master too, to keep icon names in step.
  for file in sprite.json sprite.png sprite@2x.json sprite@2x.png; do
    curl -fsSL -o "$dir/$file" "https://openmaptiles.github.io/$repo/$file"
  done
  curl -fsSL "https://raw.githubusercontent.com/openmaptiles/$repo/master/style.json" |
    jq '.sources.openmaptiles.url = "mbtiles://{v3}"
      | .glyphs = "{fontstack}/{range}.pbf"
      | .sprite = "{styleJsonFolder}/sprite"' >"$dir/style.json.tmp"
  mv "$dir/style.json.tmp" "$dir/style.json"
  fetched_style=1
done

if [ "$fetched_style" = 1 ] || [ ! -f "$DATA_DIR/fonts/.complete" ]; then
  echo "Fetching fonts"
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/fonts.zip" "$FONTS_URL"
  unzip -q "$tmp/fonts.zip" -d "$tmp/fonts"
  # Every string under text-font; expression keywords simply match no font directory.
  jq -r '[.. | objects | .["text-font"]? | arrays | .. | strings] | .[]' \
    "$DATA_DIR"/styles/*/style.json | sort -u | while IFS= read -r family; do
    if [ -d "$tmp/fonts/$family" ] && [ ! -d "$DATA_DIR/fonts/$family" ]; then
      cp -R "$tmp/fonts/$family" "$DATA_DIR/fonts/"
    fi
  done
  rm -rf "$tmp"
  touch "$DATA_DIR/fonts/.complete"
fi

echo "Map assets ready"
