#!/bin/sh
# gpt-seat setup. Idempotent: never overwrites an existing sheet, never duplicates the include line.
# 1. writes the recommended pstack model sheet if none exists
# 2. adds the @include line to the user's CLAUDE.md if missing
# 3. reports whether codex, node and git are available and whether Codex is logged in
set -eu
cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
root="$(cd "$(dirname "$0")/.." && pwd)"
sheet="$cfg/pstack-models.md"
claude_md="$cfg/CLAUDE.md"
mkdir -p "$cfg"
if [ -f "$sheet" ]; then
  echo "sheet: exists, left untouched: $sheet"
else
  cp "$root/templates/pstack-models.md" "$sheet"
  echo "sheet: written from template: $sheet"
fi
line="@$sheet"
if [ -f "$claude_md" ] && grep -qxF "$line" "$claude_md"; then
  echo "CLAUDE.md: include already present: $claude_md"
else
  printf '\n%s\n' "$line" >> "$claude_md"
  echo "CLAUDE.md: include added: $claude_md"
fi
for b in codex node git; do
  if command -v "$b" >/dev/null 2>&1; then echo "$b: $(command -v "$b")"; else echo "$b: MISSING"; fi
done
if command -v codex >/dev/null 2>&1; then
  echo "codex login: $(codex login status 2>&1 | head -n 1)"
fi
echo "codex-seat: $root/scripts/codex-seat"
