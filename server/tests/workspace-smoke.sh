#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080/api}"
DB="${DB:-zcollab}"
SUFFIX="$(date +%s)$$"
USER_A="smoke_a_${SUFFIX}"
USER_B="smoke_b_${SUFFIX}"
PASSWORD='Passw0rd!'
TMP="$(mktemp -d)"
COOKIE_A="$TMP/a.cookie"
COOKIE_B="$TMP/b.cookie"

AID=""
BID=""
ID1=""
ID2=""

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

cleanup() {
  if [ -n "$ID1" ] || [ -n "$ID2" ]; then
    psql -d "$DB" -c "DELETE FROM workspace_member WHERE workspace_id IN (${ID1:-0}, ${ID2:-0}); DELETE FROM workspace WHERE id IN (${ID1:-0}, ${ID2:-0}); DELETE FROM sys_user WHERE id IN (${AID:-0}, ${BID:-0});" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

post() {
  local cookie="$1" path="$2" body="$3"
  curl -s -c "$cookie" -b "$cookie" -H 'Content-Type: application/json' \
    -X POST "$BASE_URL$path" -d "$body"
}

check_code() {
  local response="$1" expected="$2" label="$3"
  local actual
  actual="$(echo "$response" | jq -r .code)"
  [ "$actual" = "$expected" ] || fail "$label: code=$actual, response=$response"
}

echo "== workspace smoke =="
for tool in curl jq psql; do
  command -v "$tool" >/dev/null 2>&1 || fail "缺少依赖: $tool"
done

r=$(post "$COOKIE_A" /auth/register "{\"username\":\"$USER_A\",\"password\":\"$PASSWORD\",\"name\":\"Smoke A\"}")
check_code "$r" 0 "register A"
AID="$(echo "$r" | jq -r .data.id)"

r=$(post "$COOKIE_A" /auth/login "{\"username\":\"$USER_A\",\"password\":\"$PASSWORD\"}")
check_code "$r" 0 "login A"

r=$(post "$COOKIE_A" /users/me '{}')
check_code "$r" 0 "me A (empty)"
[ "$(echo "$r" | jq -r '.data.activeWorkspace')" = "null" ] || fail "新账号 activeWorkspace 应为 null"
[ "$(echo "$r" | jq -r '.data.workspaces.items | length')" = "0" ] || fail "新账号 workspaces 应为空"

r=$(post "$COOKIE_A" /workspace/create '{"name":"Smoke One"}')
check_code "$r" 0 "create workspace 1"
ID1="$(echo "$r" | jq -r .data.id)"

r=$(post "$COOKIE_A" /workspace/create '{"name":"Smoke Two"}')
check_code "$r" 0 "create workspace 2"
ID2="$(echo "$r" | jq -r .data.id)"

r=$(post "$COOKIE_A" /users/me '{}')
check_code "$r" 0 "me A (two workspaces)"
[ "$(echo "$r" | jq -r '.data.workspaces.items | length')" = "2" ] || fail "应有两个工作区"
[ "$(echo "$r" | jq -r '.data.workspaces.total')" = "2" ] || fail "workspaces total 应为 2"
[ "$(echo "$r" | jq -r '.data.activeWorkspace.id')" = "$ID2" ] || fail "最新创建的工作区应为当前工作区"

r=$(post "$COOKIE_A" /workspace/switch "{\"id\":\"$ID1\"}")
check_code "$r" 0 "switch to workspace 1"
[ "$(echo "$r" | jq -r '.data.name')" = "Smoke One" ] || fail "switch 返回名称不匹配"

r=$(post "$COOKIE_A" /workspace/info '{}')
check_code "$r" 0 "info"
[ "$(echo "$r" | jq -r '.data.name')" = "Smoke One" ] || fail "info 名称未跟随切换"
[ "$(echo "$r" | jq -r '.data.memberCount')" = "1" ] || fail "memberCount 应为 1"

r=$(post "$COOKIE_A" /workspace/members '{}')
check_code "$r" 0 "members"
[ "$(echo "$r" | jq -r '.data.items | length')" = "1" ] || fail "成员数应为 1"
[ "$(echo "$r" | jq -r '.data.total')" = "1" ] || fail "成员 total 应为 1"
[ "$(echo "$r" | jq -r '.data.page')" = "1" ] || fail "默认 page 应为 1"
[ "$(echo "$r" | jq -r '.data.pageSize')" = "20" ] || fail "默认 pageSize 应为 20"
[ "$(echo "$r" | jq -r '.data.items[0].role')" = "owner" ] || fail "创建者角色应为 owner"

r=$(post "$COOKIE_B" /auth/register "{\"username\":\"$USER_B\",\"password\":\"$PASSWORD\",\"name\":\"Smoke B\"}")
check_code "$r" 0 "register B"
BID="$(echo "$r" | jq -r .data.id)"

r=$(post "$COOKIE_B" /auth/login "{\"username\":\"$USER_B\",\"password\":\"$PASSWORD\"}")
check_code "$r" 0 "login B"

r=$(post "$COOKIE_B" /users/me '{}')
check_code "$r" 0 "me B"
[ "$(echo "$r" | jq -r '.data.activeWorkspace')" = "null" ] || fail "B 不应有当前工作区"
[ "$(echo "$r" | jq -r '.data.workspaces.items | length')" = "0" ] || fail "B 不应有工作区"

status="$(curl -s -o "$TMP/403.json" -w '%{http_code}' -c "$COOKIE_B" -b "$COOKIE_B" \
  -H 'Content-Type: application/json' -X POST "$BASE_URL/workspace/switch" -d "{\"id\":\"$ID1\"}")"
[ "$status" = "403" ] || fail "越权 switch 应返回 403，实际 $status"
check_code "$(cat "$TMP/403.json")" 403 "forbidden switch"

status="$(curl -s -o "$TMP/400.json" -w '%{http_code}' -c "$COOKIE_A" -b "$COOKIE_A" \
  -H 'Content-Type: application/json' -X POST "$BASE_URL/workspace/create" -d '{"name":""}')"
[ "$status" = "400" ] || fail "空名称应返回 400，实际 $status"
check_code "$(cat "$TMP/400.json")" 1001 "validation"

ws_count="$(psql -d "$DB" -Atc "SELECT count(*) FROM workspace WHERE id IN ($ID1, $ID2)")"
member_count="$(psql -d "$DB" -Atc "SELECT count(*) FROM workspace_member WHERE workspace_id IN ($ID1, $ID2)")"
owner_count="$(psql -d "$DB" -Atc "SELECT count(*) FROM workspace_member WHERE workspace_id IN ($ID1, $ID2) AND role='owner'")"
[ "$ws_count" = "2" ] || fail "DB 工作区行数应为 2，实际 $ws_count"
[ "$member_count" = "2" ] || fail "DB 成员行数应为 2，实际 $member_count"
[ "$owner_count" = "2" ] || fail "DB owner 行数应为 2，实际 $owner_count"

psql -d "$DB" -c "INSERT INTO workspace_member (id, workspace_id, user_id, role, created_at) SELECT (extract(epoch from now())::bigint * 1000000) + 1, $ID1, $BID, 'member', now() ON CONFLICT (workspace_id, user_id) DO NOTHING" >/dev/null
r=$(post "$COOKIE_A" /workspace/members '{"page":1,"pageSize":1}')
check_code "$r" 0 "members paged"
[ "$(echo "$r" | jq -r '.data.items | length')" = "1" ] || fail "pageSize=1 时应只有 1 条"
[ "$(echo "$r" | jq -r '.data.total')" = "2" ] || fail "分页 total 应为 2"
[ "$(echo "$r" | jq -r '.data.page')" = "1" ] || fail "page 应为 1"
[ "$(echo "$r" | jq -r '.data.pageSize')" = "1" ] || fail "pageSize 应为 1"

r=$(post "$COOKIE_A" /workspace/switch "{\"id\":\"$ID2\"}")
check_code "$r" 0 "switch to workspace 2 before stale check"
psql -d "$DB" -c "DELETE FROM workspace_member WHERE workspace_id = $ID2 AND user_id = $AID" >/dev/null

r=$(post "$COOKIE_A" /users/me '{}')
check_code "$r" 0 "me after stale session"
[ "$(echo "$r" | jq -r '.data.activeWorkspace.id')" = "$ID1" ] || fail "失效会话应回退到剩余工作区"
[ "$(echo "$r" | jq -r '.data.workspaces.items | length')" = "1" ] || fail "移除成员后应只剩 1 个工作区"
[ "$(echo "$r" | jq -r '.data.workspaces.total')" = "1" ] || fail "移除成员后 workspaces total 应为 1"

r=$(post "$COOKIE_A" /workspace/info '{}')
check_code "$r" 0 "info after stale session"
[ "$(echo "$r" | jq -r '.data.id')" = "$ID1" ] || fail "info 应回退到剩余工作区，而不是 403"

echo "PASS: 全部 workspace smoke 检查通过"
