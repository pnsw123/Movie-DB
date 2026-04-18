#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT_DIR" >&2
  exit 1
fi

set -a
source .env
set +a

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"

BASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1"
SEED_TAG="seed$(date +%Y%m%d%H%M%S)"

api_json() {
  local method="$1"
  local path="$2"
  local data="$3"
  local prefer="${4:-return=representation}"

  curl --fail-with-body -sS -X "$method" \
    "${BASE_URL}/${path}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: ${prefer}" \
    -d "$data"
}

api_get() {
  local path="$1"
  curl --fail-with-body -sS \
    "${BASE_URL}/${path}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
}

movies_payload="$(jq -n --arg tag "$SEED_TAG" '[
  {
    title: "Neon Harbor",
    slug: ("neon-harbor-" + $tag),
    release_date: "2021-09-17",
    runtime_minutes: 112,
    age_rating: "PG-13",
    original_language: "en",
    country: "US",
    overview: "A rookie detective uncovers a smuggling ring in a floating city."
  },
  {
    title: "Borrowed Summer",
    slug: ("borrowed-summer-" + $tag),
    release_date: "2019-06-21",
    runtime_minutes: 98,
    age_rating: "PG",
    original_language: "en",
    country: "US",
    overview: "Two siblings rebuild their family diner over one chaotic summer."
  },
  {
    title: "Orbit Station Nine",
    slug: ("orbit-station-nine-" + $tag),
    release_date: "2023-11-03",
    runtime_minutes: 126,
    age_rating: "R",
    original_language: "en",
    country: "CA",
    overview: "A stranded crew races to stop a failing reactor before reentry."
  }
]')"
movies_resp="$(api_json POST "movies" "$movies_payload")"
echo "$movies_resp" >/tmp/seed_movies.json

series_payload="$(jq -n --arg tag "$SEED_TAG" '[
  {
    title: "Metro Shift",
    slug: ("metro-shift-" + $tag),
    first_air_date: "2020-01-14",
    last_air_date: null,
    status: "ongoing",
    overview: "Night-shift paramedics balance emergencies and family life."
  },
  {
    title: "Pine County",
    slug: ("pine-county-" + $tag),
    first_air_date: "2018-10-02",
    last_air_date: "2022-05-19",
    status: "ended",
    overview: "A small-town sheriff tracks crimes tied to old mining tunnels."
  }
]')"
series_resp="$(api_json POST "tv_series" "$series_payload")"
echo "$series_resp" >/tmp/seed_series.json

count_rows() {
  local table="$1"
  api_get "${table}?select=*" | jq 'length'
}

movies_count="$(count_rows movies)"
series_count="$(count_rows tv_series)"

jq -n \
  --arg seed_tag "$SEED_TAG" \
  --argjson movies "$movies_count" \
  --argjson tv_series "$series_count" \
  '{
    seed_tag: $seed_tag,
    totals: {
      movies: $movies,
      tv_series: $tv_series
    }
  }'
