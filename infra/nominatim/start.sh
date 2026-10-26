#!/bin/bash
# Wraps the image's start script. Nominatim ships without special phrases, and
# without them a search by kind of place ("supermarket", "cafe") near a point
# finds nothing. The import replaces the whole set and takes about a second,
# so it simply runs on every start once the API answers.
set -e

(
  until curl -sf http://localhost:8080/status >/dev/null; do sleep 10; done
  cd /nominatim && sudo -E -u nominatim nominatim special-phrases \
    --import-from-csv /seneca/special-phrases.csv
) &

exec /app/start.sh
