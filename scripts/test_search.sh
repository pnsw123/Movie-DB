#!/bin/bash
# Tests for migration 20260417010000 — native full-text search functions
# Run after: supabase db push --linked AND after seeding movies
#
# Usage: bash scripts/test_search.sh

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
  local label="$1"
  local condition="$2"
  if eval "$condition"; then
    echo "  ✅  $label"
    ((PASS++))
  else
    echo "  ❌  $label"
    ((FAIL++))
  fi
}

rpc() {
  local fn="$1"
  local body="$2"
  curl -s -X POST "${BASE}/rest/v1/rpc/${fn}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

is_array() { python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,list) else 1)" <<< "$1" 2>/dev/null; }
count()    { python3 -c "import sys,json; print(len(json.load(sys.stdin)))" <<< "$1" 2>/dev/null; }
has_key()  { python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d and '$2' in d[0] else 1)" <<< "$1" 2>/dev/null; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Search function tests"
echo "═══════════════════════════════════════════════════"
echo ""

echo "── search_movies ───────────────────────────────────"

# 1. Empty query returns all movies (up to page_size)
BODY=$(rpc search_movies '{"query_text":"","page_size":5}')
check "Empty query returns array"             "is_array '$BODY'"
check "Empty query respects page_size=5"      "[ \$(count '$BODY') -le 5 ]"
check "Result has expected columns"           "has_key '$BODY' title"

# 2. Keyword search returns results
BODY=$(rpc search_movies '{"query_text":"dark"}')
check "Keyword search returns array"          "is_array '$BODY'"

# 3. Language filter works
BODY=$(rpc search_movies '{"query_text":"","lang":"en","page_size":20}')
check "Language filter returns array"         "is_array '$BODY'"
ALL_EN=$(python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(all(r.get('original_language')=='en' for r in rows))
" <<< "$BODY" 2>/dev/null)
check "All results match language filter"     "[ '$ALL_EN' = 'True' ]"

# 4. Year range filter works
BODY=$(rpc search_movies '{"query_text":"","min_year":2020,"max_year":2023,"page_size":20}')
check "Year range filter returns array"       "is_array '$BODY'"

# 5. No results query returns []
BODY=$(rpc search_movies '{"query_text":"xyzzy_impossible_match_zqwerty"}')
check "No-match query returns []"             "[ '$BODY' = '[]' ]"

# 6. page_size capped at 100
BODY=$(rpc search_movies '{"query_text":"","page_size":9999}')
COUNT=$(count "$BODY")
check "page_size=9999 capped (≤100 results)"  "[ \$COUNT -le 100 ]"

echo ""
echo "── search_tv_series ────────────────────────────────"

# 7. Basic TV search
BODY=$(rpc search_tv_series '{"query_text":"","page_size":5}')
check "TV empty query returns array"          "is_array '$BODY'"
check "TV result has status column"           "has_key '$BODY' status"

# 8. Status filter
BODY=$(rpc search_tv_series '{"query_text":"","status_filter":"ongoing","page_size":20}')
check "Status filter returns array"           "is_array '$BODY'"
ALL_ONGOING=$(python3 -c "
import sys,json
rows=json.load(sys.stdin)
print(all(r.get('status')=='ongoing' for r in rows))
" <<< "$BODY" 2>/dev/null)
check "All results match status=ongoing"      "[ '$ALL_ONGOING' = 'True' ]"

echo ""
echo "── search_all ──────────────────────────────────────"

# 9. Combined search returns both types
BODY=$(rpc search_all '{"query_text":"","page_size":20}')
check "search_all returns array"              "is_array '$BODY'"
check "search_all has type column"            "has_key '$BODY' type"

HAS_BOTH=$(python3 -c "
import sys,json
rows=json.load(sys.stdin)
types={r.get('type') for r in rows}
print('movie' in types and 'tv' in types)
" <<< "$BODY" 2>/dev/null)
check "search_all returns both movies and tv" "[ '$HAS_BOTH' = 'True' ]"

# 10. Relevance is ordered descending
BODY=$(rpc search_all '{"query_text":"the","page_size":10}')
ORDERED=$(python3 -c "
import sys,json
rows=json.load(sys.stdin)
rels=[r.get('relevance',0) for r in rows]
print(rels == sorted(rels, reverse=True))
" <<< "$BODY" 2>/dev/null)
check "Results ordered by relevance desc"     "[ '$ORDERED' = 'True' ]"

echo ""
echo "── Breaking tests ──────────────────────────────────"

# 11. SQL injection in query_text is safe (plainto_tsquery escapes it)
BODY=$(rpc search_movies "{\"query_text\":\"'; DROP TABLE movies; --\"}")
check "SQL injection in query_text is safe"   "is_array '$BODY'"

# 12. Very long query doesn't crash
LONG=$(python3 -c "print('a '*1000)")
BODY=$(rpc search_movies "{\"query_text\":\"${LONG}\"}")
check "Very long query handled gracefully"    "is_array '$BODY'"

# 13. Unicode query works
BODY=$(rpc search_movies '{"query_text":"café naïve résumé"}')
check "Unicode query returns array"           "is_array '$BODY'"

echo ""
echo "═══════════════════════════════════════════════════"
printf "  Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "═══════════════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
