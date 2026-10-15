# pstack-gpt-seat

Claude Code 用 [pstack](https://github.com/michael-denyer/pstack-claude) に、GPT（Codex CLI 経由の gpt-6-astra）の席を1つ足すプラグインです。pstack 本体には手を入れず、その上に重ねて使います。

**English:** A companion plugin for pstack on Claude Code. It adds one GPT runner or reviewer (gpt-6-astra through the Codex CLI, in its own git worktree) to pstack's `arena`, `architect` and `interrogate` panels, leaving pstack itself untouched. Install both marketplaces, run `/gpt-seat:setup-gpt-seat`, let Claude Code assist with Codex sign-in if needed, and start a new session. Japanese documentation follows.

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
- [Codex CLI](https://developers.openai.com/codex/cli)（0.154 以降）と ChatGPT のサブスクリプション。未ログインなら、セットアップ中にClaude Codeからログインを開始できます。
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

未ログインなら、Claude Codeが `codex login` を開始し、利用できるブラウザ操作ツールで認証を進めます。本人の操作が必要な認証画面や、ブラウザ操作ツールがない場合だけ、その操作を依頼します。ログイン済みなら既存の認証をそのまま使います。完了後に `codex login status` で確認し、セットアップを続けます。

認証だけを行う場合は `/gpt-seat:login-codex` を使えます。通常のログインでブラウザやコールバックに問題がある場合は、対応環境で `codex login --device-auth` に切り替えます。詳細は [OpenAI公式の認証手順](https://learn.chatgpt.com/docs/auth) を参照してください。

最後に新しいセッションを開いてください。席の指示はセッション開始時に注入されます。

## 使い方

普段どおり pstack を使うだけです。`/pstack:arena` を回すと候補が opus・fable・gpt-6-astra の3本になり、`/pstack:interrogate` のレビュアー一覧に gpt-6-astra が加わります。Codex にログインしていないときは、GPT 席を起動する前にログインを進めます。認証がキャンセルされた場合や失敗した場合は、その回の GPT 席を飛ばして Claude だけで進み、理由を伝えます。

`codex-seat` は単体でも使えます。

```bash
printf '%s' "レビューの依頼文" | ~/.claude/plugins/cache/pstack-gpt-seat/gpt-seat/0.1.3/scripts/codex-seat --write gpt-6-astra high /path/to/worktree
```

## 標準の役割分担（0.1.2以降）

Claudeが窓口になり、依頼の整理、Codexの呼び出し、結果の確認、成果の統合を担当します。ログイン操作とファイル作成・編集・書き込みはCodexへ任せます。pstack外の通常作業にも適用し、ユーザーが担当を指定した依頼はその指定を優先します。

- **ファイル編集**: Claudeが専用のgit worktreeと作業指示を用意し、`codex-seat --write` でCodexを実行します。実ファイルと差分、必要なテストで結果を確認してから、Claudeが成果を統合・コミットします。Git管理外のファイルは一時Git作業場所で編集し、確認後に元の保存先へ反映します。
- **サービスのログイン**: `codex-seat --browser` でCodexを呼び出し、設定済みのCUA（ブラウザ・アプリ操作）を使います。既存のログイン状態や正規の自動入力を利用します。実際の接続先とログイン後の画面を確認し、利用可能な経路がない場合は具体的な制約を伝えます。
- **Codex自体の初回・再認証**: Codexを呼べる状態にするため、Claudeが親環境でログインを開始して確認します。認証前のCodexへ自身の認証を依頼することはありません。[OpenAI公式の認証手順](https://learn.chatgpt.com/docs/auth)に従います。
- **本人の操作が必要な場合**: 生体認証・端末承認などの実際の障害がある工程だけ依頼し、完了後は続きを担当します。秘密情報をチャットやリポジトリへ記録しません。担当分けによって承認やサンドボックスを無効にはしません。

起動時の指示はプラグインのSessionStartフックで読み込まれます。このリポジトリでの具体的な運用は [AGENTS.md](AGENTS.md) を [CLAUDE.md](CLAUDE.md) からも読み込みます。以前の「Codexには作らせない」「ログインは必ず本人が行う」というローカル指示がある場合は、新しい担当分けとの矛盾を解消してください。プラグイン更新後はClaude Codeの新しいセッションで使います。

## Claudeからブラウザを操作する（0.1.3以降）

```bash
# CUA設定だけを確認（認証情報は表示しない）
node /path/to/gpt-seat/scripts/check-browser.mjs

# ClaudeのBashから呼ぶ。依頼に対象サービスと完了条件を含める。
printf '%s' "GitHubを開き、既存ログインを使って指定の非公開リポジトリを表示し、認証状態を確認して" | /path/to/gpt-seat/scripts/codex-seat --browser gpt-6-astra high /path/to/project
```

スクリーンショットなどを保存する場合は `--browser --write` と専用worktreeを使います。`--browser` はCUAの設定チェックと[操作手順](plugins/gpt-seat/docs/browser-operation.md)を追加します。公式のCUA連携がCodex側で有効であり、Macのアプリ操作権限が利用できることが前提です。MCPの設定方法は[OpenAI公式ドキュメント](https://learn.chatgpt.com/docs/extend/mcp)を参照してください。個人の設定ファイルや認証情報はこのリポジトリへコピーしません。

接続済みブラウザがあれば使用し、接続一覧が空でもChromeアプリの操作が使える場合はCUAの `cua.getApp("Google Chrome")` で画面を操作します。ユーザーがブラウザを指定した場合はその指定を優先します。ClaudeとCodexで同じブラウザを同時操作しません。設定チェックの成功と、ブラウザ接続・認証成功は別々に確認します。

ブラウザモードでは認証画面を含み得る生のツール診断出力を保存・表示しません。Codexは秘密情報を除いた最終結果と、必要な場合だけ認証情報を含まない成果画面を返します。`read-only` はシェルのファイル操作に対する制約で、ブラウザ上の送信・変更を防ぐものではありません。依頼の範囲と通常の承認を守ります。

### 動作確認（2026-10-16）

このMacで、Claude Code → `codex-seat --browser --write` → Codex（gpt-6-astra）→ CUAのChromeアプリ操作を確認しました。親Codexデスクトップのセッション識別用環境変数を渡さない起動でも、GitHubのログイン入口から既存セッションを再利用し、対象の非公開リポジトリとログイン済みアカウント表示を確認できました。保存された成果画面も確認済みです。未ログイン状態からの新規Google認証・MFA入力は今回のテスト対象には含みません。

ラッパーの回帰確認は `python3 -m unittest discover -s tests -v` で実行できます。認証情報を使わず、通常モード、ブラウザモードと書き込みモードの組み合わせ、接続設定不足での停止、診断出力の秘匿を検証します。

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
