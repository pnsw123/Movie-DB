#!/bin/bash
# Tests for migration 20260417000000
# Run after: supabase db push --linked
#
# Usage: bash scripts/test_migration.sh

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

SERVICE="${SUPABASE_SERVICE_ROLE_KEY}"

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
  # Call run_query RPC, return HTTP body
  local key="$1"
  local sql="$2"
  curl -s -X POST "${BASE}/rest/v1/rpc/run_query" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -d "{\"query_text\": $(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$sql")}"
}

rest() {
  local key="$1"
  local path="$2"
  curl -s -o /dev/null -w "%{http_code}" \
    "${BASE}/rest/v1/${path}" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}"
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Migration test: saved_queries + run_query RPC"
echo "═══════════════════════════════════════════════════"
echo ""

echo "── Table structure ─────────────────────────────────"

# 1. saved_queries table exists and has 7 default rows
COUNT=$(curl -s "${BASE}/rest/v1/saved_queries?is_default=eq.true&select=id" \
  -H "apikey: ${SERVICE}" \
  -H "Authorization: Bearer ${SERVICE}" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
check "7 default queries seeded" "[ '$COUNT' = '7' ]"

# 2. Anon can read default queries
CODE=$(rest "$ANON_KEY" "saved_queries?is_default=eq.true&select=title")
check "Anon can SELECT default queries (200)" "[ '$CODE' = '200' ]"

# 3. Anon cannot read non-default queries (should be empty due to RLS, not 403)
BODY=$(curl -s "${BASE}/rest/v1/saved_queries?is_default=eq.false&select=title" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}")
check "Anon gets empty list for user queries (RLS)" "[ '$BODY' = '[]' ]"

echo ""
echo "── run_query — valid queries ────────────────────────"

# 4. Valid SELECT returns JSON array
BODY=$(rpc "$ANON_KEY" "SELECT 1 AS num")
check "SELECT 1 returns JSON array" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if isinstance(d,list) else 1)\" 2>/dev/null"

# 5. SELECT from movies works
BODY=$(rpc "$ANON_KEY" "SELECT id, title FROM movies LIMIT 1")
check "SELECT from movies returns JSON" "echo '$BODY' | python3 -c \"import sys,json; json.load(sys.stdin)\" 2>/dev/null"

# 6. Returns empty array when no rows
BODY=$(rpc "$ANON_KEY" "SELECT * FROM movies WHERE id = -999")
check "No-match query returns [] not null" "[ '$BODY' = '[]' ]"

echo ""
echo "── run_query — rejection tests (breaking attempts) ──"

# 7. DROP TABLE rejected
BODY=$(rpc "$SERVICE" "DROP TABLE movies")
check "DROP TABLE rejected" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if 'SELECT' in str(d.get('message','')) or 'Only SELECT' in str(d.get('message','')) or 'permitted' in str(d.get('message','')) else 1)\" 2>/dev/null"

# 8. INSERT rejected
BODY=$(rpc "$SERVICE" "INSERT INTO movies(title) VALUES('hacked')")
check "INSERT rejected" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if 'permitted' in str(d) or 'SELECT' in str(d) else 1)\" 2>/dev/null"

# 9. UPDATE rejected
BODY=$(rpc "$SERVICE" "UPDATE movies SET title='hacked' WHERE id=1")
check "UPDATE rejected" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if 'permitted' in str(d) or 'SELECT' in str(d) else 1)\" 2>/dev/null"

# 10. Embedded semicolon rejected (multi-statement injection)
BODY=$(rpc "$SERVICE" "SELECT 1; DROP TABLE movies")
check "Embedded semicolon rejected" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if 'single' in str(d) or 'permitted' in str(d) else 1)\" 2>/dev/null"

# 11. Empty string rejected
BODY=$(rpc "$SERVICE" "")
check "Empty query rejected" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if 'error' in str(d).lower() or 'permitted' in str(d) or 'SELECT' in str(d) else 1)\" 2>/dev/null"

# 12. Comment-prefixed injection rejected
BODY=$(rpc "$SERVICE" "-- comment\nDROP TABLE movies")
check "Comment-then-DROP rejected (doesn't start with SELECT)" "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); exit(0 if 'permitted' in str(d) or 'SELECT' in str(d) else 1)\" 2>/dev/null"

echo ""
echo "═══════════════════════════════════════════════════"
printf "  Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "═══════════════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
