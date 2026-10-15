#!/bin/sh
# Prints the GPT seat instructions with the plugin's codex-seat path filled in.
# Claude Code adds SessionStart stdout to the session context (same mechanism pstack uses).
set -eu
root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
sed "s|__CODEX_SEAT__|${root}/scripts/codex-seat|g" "${root}/hooks/gpt-seat-context.md"
