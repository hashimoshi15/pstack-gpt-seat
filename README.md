# pstack-gpt-seat

Claude Code 用 [pstack](https://github.com/michael-denyer/pstack-claude) に、GPT（Codex CLI 経由の gpt-6-astra）の席を1つ足すプラグインです。pstack 本体には手を入れず、その上に重ねて使います。

**English:** A companion plugin for pstack on Claude Code. It adds one GPT runner or reviewer (gpt-6-astra through the Codex CLI, in its own git worktree) to pstack's `arena`, `architect` and `interrogate` panels, leaving pstack itself untouched. Install both marketplaces, run `/gpt-seat:setup-gpt-seat`, sign in with `codex login`, and start a new session. Japanese documentation follows.

## 何が変わるか

Claude Code の `Agent` ツールは Claude のモデル名しか受け付けないので、pstack のパネル（arena の候補、architect の設計案、interrogate のレビュアー）は Claude だけで閉じます。このプラグインは、各パネルに GPT の席を1つ足します。

| pstack の skill | Claude（シート） | 追加される GPT 席 |
| --- | --- | --- |
| `pstack:arena` の候補 | opus, fable | gpt-6-astra が自分の worktree でコードを書く |
| `pstack:architect` の設計案 | opus, fable | gpt-6-astra が候補ディレクトリに設計スケッチを書く |
| `pstack:interrogate` のレビュアー | opus, fable | gpt-6-astra がレビュー用 worktree でテストやビルドを回しながらレビューする |
| arena の審判 | fable / opus（親と違う方） | 追加なし。判断役は Claude に残す |

仕組みは2つだけです。

- `scripts/codex-seat`: `codex exec` のラッパー。`--write` を付けると workspace-write サンドボックスで動き、git worktree 以外のディレクトリを拒否します。付けなければ read-only です。
- `hooks/session-start.sh`: セッション開始時に「どの skill のどこに席を足すか」の指示を注入します。pstack 自身の routing hook と同じ仕組みなので、CLAUDE.md を手で編集する必要はありません。

モデルの選定理由とベンチマークは [docs/model-design.md](plugins/gpt-seat/docs/model-design.md) にあります。

## 前提

- Claude Code と、[pstack-claude](https://github.com/michael-denyer/pstack-claude) のプラグイン。
- [Codex CLI](https://developers.openai.com/codex/cli)（0.154 以降）と ChatGPT のサブスクリプション。`codex login` でサインインしておきます。
- Node.js 18 以上（pstack 付属のスクリプト用）。
- git。

## インストール

Claude Code の中で次を実行します。

```text
/plugin marketplace add michael-denyer/pstack-claude
/plugin install pstack@pstack-claude
/plugin marketplace add hashimoshi15/pstack-gpt-seat
/plugin install gpt-seat@pstack-gpt-seat
/gpt-seat:setup-gpt-seat
```

`setup-gpt-seat` は、pstack のモデルシート `~/.claude/pstack-models.md` が無ければ推奨値（[templates/pstack-models.md](plugins/gpt-seat/templates/pstack-models.md)）で作り、`~/.claude/CLAUDE.md` にその読み込み行を足し、Codex CLI と Node.js とログイン状態を確認します。既にシートがある場合は触らず、パネルの推奨値を案内します。

最後に、自分の端末で `codex login` を済ませ、新しいセッションを開いてください。席の指示はセッション開始時に注入されます。

## 使い方

普段どおり pstack を使うだけです。`/pstack:arena` を回すと候補が opus・fable・gpt-6-astra の3本になり、`/pstack:interrogate` のレビュアー一覧に gpt-6-astra が加わります。Codex にログインしていないときは GPT 席を飛ばして Claude だけで進み、その旨が出力されます。

`codex-seat` は単体でも使えます。

```bash
printf '%s' "レビューの依頼文" | ~/.claude/plugins/cache/pstack-gpt-seat/gpt-seat/0.1.0/scripts/codex-seat --write gpt-6-astra high /path/to/worktree
```

## 制約

- Codex は linked worktree の中でコミットできません（git のメタデータがサンドボックスの外にあるため）。親の Claude が成果を読んでからコミットします。
- サンドボックス内はネットワークが無効です。テストに依存パッケージが要る場合は、本体の `node_modules` などを worktree に symlink します（注入される指示に含まれています）。
- OpenAI 公式の Codex plugin for Claude Code は、常駐プロセスの孤児化（issue #543 / #801）が pstack の並列 worktree と相性が悪いため使っていません。修正されたら乗り換えを検討します。

## 更新と削除

```text
/plugin update gpt-seat@pstack-gpt-seat
/plugin uninstall gpt-seat@pstack-gpt-seat
```

削除してもモデルシートと CLAUDE.md の読み込み行は残ります。不要なら手で消してください。

## ライセンス

MIT。pstack は Michael Denyer による Claude Code 移植版で、原作は Lauren Tan の pstack です。このプラグインは pstack のコードを含みません。
