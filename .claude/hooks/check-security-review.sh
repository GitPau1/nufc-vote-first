#!/usr/bin/env bash
# PreToolUse 훅 (matcher: Bash, if: Bash(gh pr create*)).
# 브랜치가 보안 민감 경로(인증/API/마이그레이션/관리자)를 건드렸는데
# 이번 HEAD 기준으로 code-review/security-review를 돌린 적이 없으면
# gh pr create 자체를 막는다. (subagent-workflow-lessons.md #13/#16)
#
# 2026-09-04 수정: settings.json의 "if": "Bash(gh pr create*)"가 실제로는
# gh pr create와 무관한 Bash 호출에도 이 스크립트를 실행시키는 게 관찰됐다
# (원인 미확인 — 하네스 쪽 "if" 필터링 버그로 추정). 그래서 "if"에만 기대지 않고
# 스크립트 자신도 stdin의 실제 명령어를 보고 gh pr create 계열이 아니면 즉시
# 통과시키도록 이중 방어를 건다.
set -euo pipefail

hook_input=$(cat) || hook_input=''
command=$(printf '%s' "$hook_input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

if ! printf '%s' "$command" | grep -qE '(^|[;&|]\s*)gh\s+pr\s+create(\s|$)'; then
  echo '{}'
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo '{}'; exit 0; }
cd "$repo_root"

merge_base=$(git merge-base main HEAD 2>/dev/null) || { echo '{}'; exit 0; }
changed_files=$(git diff --name-only "$merge_base"...HEAD 2>/dev/null || true)

# 보안 민감 경로 패턴 — 인증/API 라우트/마이그레이션/관리자/미들웨어.
sensitive_pattern='(^|/)(auth|middleware\.ts|admin)(/|\.|$)|supabase/migrations/|frontend/src/app/api/'

if ! printf '%s\n' "$changed_files" | grep -qiE "$sensitive_pattern"; then
  echo '{}'
  exit 0
fi

marker="$repo_root/.claude/.security-review-passed"
current_head=$(git rev-parse HEAD)

if [ -f "$marker" ] && [ "$(cat "$marker")" = "$current_head" ]; then
  echo '{}'
  exit 0
fi

cat <<JSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "이 브랜치가 보안 민감 경로(인증/API/마이그레이션/관리자)를 건드립니다. code-review 또는 security-review 스킬을 먼저 돌리고, 끝나면 'git rev-parse HEAD > .claude/.security-review-passed'로 마커를 남긴 뒤 다시 시도하세요."
  }
}
JSON
