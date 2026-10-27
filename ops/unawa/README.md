# unawa-ops：Mac miniに依存しない日次運用

うな和の日次運用のうち、画面の前に人がいなくてよい仕事をGitHub Actionsで動かします。Mac miniが止まっても、売上の取得・食べログの照合・公開URLの確認・止まった仕事の見張りは続きます。

## 何が、いつ動くか（日本時間）

| 時刻 | ジョブ | 内容 | 結果の行き先 |
| --- | --- | --- | --- |
| 07:10 | 食べログ照合 `tabelog` | 4店（四条堺町・清水はなれ・祇園八坂・泉）の店名・住所・営業時間・PR・サービス料を、承認済みの基準と比べる | Discord（違いがあれば【要確認】） |
| 08:40 | 売上取得 `sales` | ASPIT（うな和6店）とUSEN（和く・Fruits fondue）の前日分を画面から読み取り、Mac版と同じ縦持ちCSVで保存 | `unawa-data` ブランチ、設定すればDrive、Discordには件数だけ |
| 10:20 | 見張り `health` | 売上・食べログの保存が止まっていないかを確認 | Discord（止まっていれば【要対応】） |
| 18:40 | 公開URL確認 `urls` | `config/watch-urls.json` の公開済み投稿が表示できるか | Discord |

このほか、Claudeのクラウド定期タスク「うな和 日報の見張り（Mac非依存）」が毎日15:17にDriveのMac版日報を読み、止まっている仕事をスマホに通知します。

取得結果は `main` を汚さないよう、`unawa-data` ブランチに日付ごとに積みます。売上額はDiscordへ送りません。

## 使い始める手順

リポジトリの Settings → Secrets and variables → Actions で登録します。値をチャットやファイルに書かないでください。

### 1. 通知（必須）

- Secret `DISCORD_WEBHOOK_URL`：通知先チャンネルの「連携サービス → ウェブフック」で作ったURL。

### 2. 売上取得

- Secret `ASPIT_LOGIN_ID`・`ASPIT_PASSWORD`（ログイン画面に企業コード欄があれば `ASPIT_COMPANY_CODE` も）
- Secret `USEN_LOGIN_ID`・`USEN_PASSWORD`（USEN会員サイト umembers.usen.com のもの）
- できれば閲覧専用のアカウントを発行してもらって使ってください。2段階認証や画像認証が出た場合、ジョブは回避せずに止まり、Discordで知らせます。

### 3. Driveへの保存（任意）

個人のGoogleアカウントのDriveにはサービスアカウントで書き込めないため、OAuthを使います。

- Secret `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`GOOGLE_REFRESH_TOKEN`（Drive権限）
- Variable `UNAWA_DRIVE_SALES_FOLDER_ID`：「全データ保管用/02_売上・経営データ/日次自動取得_USEN・ASPIT」のフォルダID。この下に Mac版と同じ `ASPIT/店舗名/YYYY年/MM月/` で保存し、同名のファイルがあれば上書きしません。

### 4. 動作確認と定期実行の開始

1. Actions → unawa-ops → Run workflow で、`job` を `tabelog`、`sales`、`urls`、`health` の順に1回ずつ手動実行します。売上は `date` に取得したい日を入れれば過去日も取れます。
2. 売上が失敗したときは、実行結果の Artifacts「debug-screens」に止まった画面が残ります。画面の文言が想定と違う場合は `config/sales.json` と `src/lib/sites.mjs` を直します。
3. うまく動いたら、Variables に `UNAWA_OPS_ENABLED` = `true` を登録します。これで定期実行が始まります。
4. 食べログは初回の取得内容が基準になります。掲載文を変えたときは `tabelog` を `approve_baseline` にチェックして手動実行し、新しい基準にします。

## Mac版との対応

| Mac mini（10/27時点） | このリポジトリ |
| --- | --- |
| コハクの9:00売上ジョブ（usen-aspit-daily.mjs、AIが画面を読む。10/22から停止） | `sales`（固定の手順で画面を読む） |
| tabelog-public-pr-check.py | `tabelog` |
| sns-public-url-check.py（FB・IGはログインなしで判定不能） | `urls`（表示できるかだけを見る） |
| 日報のDiscord投稿（本人アカウントの画面操作） | 各ジョブの結果をwebhookで投稿 |
| デスクトップ版Drive・SSDへのコピー | Drive API（任意）と `unawa-data` ブランチ |

Mac版は、クラウド版が3日続けて同じ結果を出すまで並行で動かし、その後に止めてください。

## Macや本人に残るもの

- TikTokの予約停止など、アプリでしかできない操作。
- Instagram・Facebookのログインが必要な確認や、AI表示の設定。
- 動画制作の権利・費用の判断。

## 開発

```bash
cd ops/unawa
npm ci
npx playwright install chromium
npm test   # 模擬のASPIT・USEN画面を立てて、ログインからCSV保存までを確かめる
```
