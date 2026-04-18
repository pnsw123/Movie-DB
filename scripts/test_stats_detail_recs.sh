#!/bin/bash
# Tests for migration 20260417020000 — stats views + detail RPCs + recommendations
# Run after: migration applied AND movies/tv seeded
#
# Usage: bash scripts/test_stats_detail_recs.sh

set -euo pipefail

source .env

BASE="https://${SUPABASE_PROJECT_REF}.supabase.co"
ANON_KEY=$(curl -s -X GET \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/api-keys" \
  -H "Authorization: Bearer ${SUPABASE_ACCOUNT_KEY}" | python3 -c "
import sys, json
keys = json.load(sys.stdin)
for k in keys:
    if k.get('name') == 'anon':
        print(k['api_key'])
        break
")

PASS=0
FAIL=0

check() {
  local label="$1"; local cond="$2"
  if eval "$cond"; then
    echo "  ✅  $label"; PASS=$((PASS+1))
  else
    echo "  ❌  $label"; FAIL=$((FAIL+1))
  fi
}

rpc() {
  curl -s -X POST "${BASE}/rest/v1/rpc/$1" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "$2"
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Stats + detail + recommendations tests"
echo "═══════════════════════════════════════════════════"
echo ""

# ── movie_stats view
echo "── movie_stats view ────────────────────────────────"
BODY=$(curl -s "${BASE}/rest/v1/movie_stats?select=movie_id,avg_rating,total_ratings,total_reviews&limit=5" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}")
check "movie_stats readable by anon" \
  "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,list) else 1)' 2>/dev/null"
check "movie_stats has expected columns" \
  "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if not d or all(k in d[0] for k in [\"movie_id\",\"avg_rating\",\"total_ratings\",\"total_reviews\"]) else 1)' 2>/dev/null"

# ── tv_series_stats view
echo ""
echo "── tv_series_stats view ────────────────────────────"
BODY=$(curl -s "${BASE}/rest/v1/tv_series_stats?select=tv_series_id,avg_rating,total_ratings,total_reviews&limit=5" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}")
check "tv_series_stats readable by anon" \
  "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,list) else 1)' 2>/dev/null"

# ── get_movie_detail
echo ""
echo "── get_movie_detail RPC ────────────────────────────"
# Grab any movie slug
SLUG=$(curl -s "${BASE}/rest/v1/movies?select=slug&limit=1" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['slug'] if d else '')")

if [ -n "$SLUG" ]; then
  BODY=$(rpc get_movie_detail "{\"p_slug\":\"$SLUG\"}")
  check "get_movie_detail returns object" \
    "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,dict) and \"movie\" in d else 1)' 2>/dev/null"
  check "get_movie_detail has stats" \
    "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if \"stats\" in d else 1)' 2>/dev/null"
  check "get_movie_detail has reviews array" \
    "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d.get(\"reviews\"), list) else 1)' 2>/dev/null"
else
  echo "  ⚠️   No movies in DB — seed first to run detail tests"
fi

# ── get_movie_detail unknown slug returns null
BODY=$(rpc get_movie_detail '{"p_slug":"this-slug-does-not-exist-xyz"}')
check "Unknown slug returns null" "[ '$BODY' = 'null' ]"

# ── get_tv_detail
echo ""
echo "── get_tv_detail RPC ───────────────────────────────"
TV_SLUG=$(curl -s "${BASE}/rest/v1/tv_series?select=slug&limit=1" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${ANON_KEY}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['slug'] if d else '')")

if [ -n "$TV_SLUG" ]; then
  BODY=$(rpc get_tv_detail "{\"p_slug\":\"$TV_SLUG\"}")
  check "get_tv_detail returns object" \
    "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,dict) and \"tv_series\" in d else 1)' 2>/dev/null"
else
  echo "  ⚠️   No TV series in DB — seed first to run detail tests"
fi

# ── generate_recommendations
echo ""
echo "── generate_recommendations RPC ────────────────────"
# Anon call should fail (no auth.uid())
BODY=$(rpc generate_recommendations '{}')
check "Anon call rejected (no auth)" \
  "echo '$BODY' | python3 -c 'import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,dict) and (\"message\" in d or \"code\" in d) else 1)' 2>/dev/null"

echo ""
echo "═══════════════════════════════════════════════════"
printf "  Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "═══════════════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
