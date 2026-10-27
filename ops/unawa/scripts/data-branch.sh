#!/usr/bin/env bash
# 取得結果は main ではなく unawa-data ブランチに積む。
#   data-branch.sh prepare <dir>   … unawa-data を <dir> に取り出す（無ければ空で作る）
#   data-branch.sh commit <dir> <msg> … 変更があればコミットしてpushする
set -euo pipefail
BRANCH="${UNAWA_DATA_BRANCH:-unawa-data}"
cmd="$1"; dir="$2"

case "$cmd" in
  prepare)
    if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null; then
      git fetch --depth 1 origin "$BRANCH"
      git worktree add --detach "$dir" FETCH_HEAD
    else
      git worktree add --detach "$dir"
      git -C "$dir" checkout --orphan "$BRANCH"
      git -C "$dir" rm -rfq . 2>/dev/null || true
    fi
    ;;
  commit)
    msg="$3"
    git -C "$dir" add -A
    if git -C "$dir" diff --cached --quiet; then
      echo "保存する変更はありません"
      exit 0
    fi
    git -C "$dir" -c user.name="unawa-ops" -c user.email="unawa-ops@users.noreply.github.com" commit -qm "$msg"
    git -C "$dir" push origin "HEAD:refs/heads/$BRANCH"
    ;;
  *)
    echo "usage: $0 prepare|commit <dir> [message]" >&2
    exit 2
    ;;
esac
