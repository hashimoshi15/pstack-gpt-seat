# モデル設計メモ

対象: Claude Code + pstack（Claude Code 版）+ Codex CLI。2026-10 時点の公開ベンチマークに基づく。

## 前提

- Claude Code の `Agent` ツールが受け付ける model は `opus` / `fable` / `sonnet` / `haiku` の4つだけ。GPT の id をシートに書いても拒否され、pstack の仕様で同系統の既定値に戻される。
- そのため GPT モデルはシートには書かず、このプラグインが SessionStart で注入する指示と `codex-seat`（`codex exec` のラッパー）で席を足す。pstack 本体には手を入れない。
- 公式の Codex plugin for Claude Code（openai/codex-plugin-cc）は評価したうえで見送った。常駐 broker が自動終了せず孤児化する issue #543 と、並列起動で broker が増殖し削除済み worktree で回収不能になる #801 が未修正で、pstack の arena（並列起動 + worktree を後で削除）がその条件を踏むため。修正後に再検討。
- `codex mcp-server` は Codex CLI 0.154 で削除済み（app-server は MCP 非互換）。

## ベンチマーク（公開値の要約、2026-10 時点）

| モデル | SWE-bench Pro | Terminal-Bench 4.0 | AA Index | 価格 $/MTok 入力/出力 | 備考 |
| --- | --- | --- | --- | --- | --- |
| Claude Opus 5.5 | 89.9 | 66.4 | 58 | 4 / 20 | エージェント型コーディング首位。1タスクの消費トークンは多め |
| Claude Sonnet 5.5 | 81.3 | 70.6 | 56 | 2 / 10 | TB4 は Opus 超え。max effort だと Opus より高くつく |
| Claude Fable 5.1 | 81.2 | 55.8 | 53 | 10 / 50 | 推論は強いがコーディング系は Opus 5.5 未満。利用上限に注意 |
| Claude Haiku 5.5 | 64.8 | 39.2 | - | 0.10 / 0.50 | 安いが panel の品質ノイズになるので外した |
| GPT-6 Astra | DeepSWE 74.1〜74.8 | 57.9 | 53 | 10 / 50 | ARC-AGI-3 62.7、OSWorld 73.5。別系統の runner / reviewer として最適 |
| GPT-6.1 Sol | DeepSWE 75.2 (high) | GPT-6 Sol +12pt | 52 | 2 / 10 | Astra の 1/4 コストでほぼ同等。判断役には使わない |
| GPT-6 Sol | DeepSWE 68.8 | - | 48 | 2 / 10 | ARC-AGI-3 4.6。6.1 が使えるならそちら |
| GPT-6 Luna | DeepSWE 66.6 | - | - | 0.10 / 0.50 | 大量の軽作業向け。未採用 |

## 役割別の割り当てと理由（templates/pstack-models.md）

| 役割 | モデル | 理由 |
| --- | --- | --- |
| feature, refactoring / hillclimb / judgment and prose | opus | SWE-bench Pro 首位、サブスク内で最もコスパが良い主力 |
| bug-fix / perf-issue | opus @high | pstack 既定は fable だが、コーディング系は Opus 5.5 が上。推論量だけ上げる |
| strongest judgment | fable | 最終判断の一手だけ Fable を使い、上限消費を抑える |
| how explorer / why investigators / reflect tooling / swarm workers | sonnet | 読み回り・並列作業は TB4 70.6 の Sonnet が速くて安い |
| how explainer / why synthesizer / reflect judgment | opus | まとめと説明は判断力重視 |
| arena runners | opus, fable + **gpt-6-astra（--write、自分の worktree）** | 候補は「Claude 2 + GPT 1」。同じ Claude だけでは系統の多様性が出ない |
| arena cross-judge | pool `fable, opus` から親と同じでない方を 1 体（GPT 席なし） | 審判は親の偏りを検出する装置で決定者ではない。判断力の高い Claude に任せ、GPT は判断役に使わない |
| architect runners | opus, fable + **gpt-6-astra（--write、候補ディレクトリ）** | 設計案の多様性を系統差で確保 |
| interrogate reviewers | opus, fable + **gpt-6-astra @xhigh（--write、レビュー用 worktree）** | 敵対レビューは系統差が信号。read-only だとテストやビルドが回せないので、捨てる worktree の中で書き込み可にする |
| 実装の委任（依頼時のみ） | gpt-6-astra（--write、委任用 worktree） | 「Codex で実装して」と言われたときだけ poteto-mode の委任先を差し替える |
| 安価な第二意見 | gpt-6.1-sol @medium（不可なら gpt-6-sol） | Astra の 1/4 以下のコストでほぼ同等 |

## サンドボックスの使い分け

Codex の read-only サンドボックスは一切の書き込みを許さないので、テストランナーやビルドがキャッシュを書いた時点で失敗する（検証: ビルドが要る npm プロジェクトで read-only は `EPERM` で止まり、`--write` は通った）。レビューでもツールを回せるよう、GPT 席は原則 `--write` で、本物の作業ツリーとは別の worktree の中で走らせる。万一の編集も捨てる worktree に閉じる（pstack の separate-before-serializing-shared-state の原則）。ネットワークはサンドボックス内で無効のままなので、依存ディレクトリ（`node_modules`、`.venv` など）は本体から worktree に symlink して回す。

## 既知の制約

- Codex は linked worktree の中でコミットできない。worktree の git メタデータ（`.git/worktrees/<name>`）が書き込み可能領域の外にあるため `index.lock` を作れない。親（Claude）が席の成果を読んでからコミットする。
- `codex-seat --write` は git worktree 以外のディレクトリを拒否する。`--dangerously-bypass-approvals-and-sandbox` と `danger-full-access` は使わない。
- 審判と runner に同じ系統を使うと自己選好の偏りが出うる。実際の arena では Claude の親は Claude 候補を、Claude の審判は同じ系統の別候補を推し、割れた判定は pstack の手順どおり両方の根拠を読み直して解消した。審判を別系統にしない選択の代償はここに出る。
