# TripCheck AWSセットアップ

## 構成

- Cognito User Pool: メールアドレス認証
- API Gateway HTTP API: Cognito JWT認証、CORS、スロットリング
- Lambda: プロフィール、旅行、診断API
- DynamoDB: ユーザー単位のシングルテーブル
- Bedrock: JSON形式の宿・旅程・リスク・総合診断
- S3: 将来の添付ファイル用非公開バケット

フロントエンドは現在のSites配信を維持し、HTTPSでAWS APIへ接続します。

## 開発環境のデプロイ状況

- CloudFormation stack: `tripcheck-dev`
- Region: `ap-northeast-1`
- API: `https://mnyheiadjf.execute-api.ap-northeast-1.amazonaws.com`
- Cognito User Pool: `ap-northeast-1_y0S4oRa5x`
- Cognito Client: `6bjh91hmqbsu7bcjfjk44b8v21`
- DynamoDB table: `tripcheck-dev`
- Bedrock model: `jp.anthropic.claude-sonnet-4-5-20250929-v1:0`

`GET /health`は200、認証なしの`GET /trips`は401、BedrockのJP profileは実呼び出し確認済みです。

## API

| Method | Path | 内容 |
| --- | --- | --- |
| GET | `/health` | ヘルスチェック |
| GET/PUT | `/profile` | 旅行嗜好の取得・保存 |
| GET | `/trips` | 旅行一覧 |
| GET/PUT/DELETE | `/trips/{tripId}` | 旅行の取得・保存・削除 |
| POST | `/diagnoses` | Bedrock診断 |

`/health`以外はCognitoのアクセストークンが必要です。

## DynamoDBキー設計

| データ | pk | sk |
| --- | --- | --- |
| プロフィール | `USER#{sub}` | `PROFILE` |
| 旅行 | `USER#{sub}` | `TRIP#{tripId}` |
| 診断履歴 | `USER#{sub}` | `DIAGNOSIS#{tripId}#{timestamp}#{id}` |

## あなたが行う作業

1. AWSアカウントで請求アラームとMFAを設定する。
2. `ap-northeast-1`のAmazon BedrockでAnthropicの初回利用フォームを提出し、モデル利用条件を確認する。
3. AWS CLIとAWS SAM CLIをインストールし、管理者ではなくデプロイ用IAM権限でログインする。
4. `infrastructure`で `npm install`、`npm run check` を実行する。
5. プロジェクトルートで `sam build --template-file infrastructure/template.yaml` を実行する。
6. 初回のみ `sam deploy --guided` を実行し、リージョンは `ap-northeast-1` を選ぶ。
7. 出力されたAPI URL、User Pool ID、Client IDを `.env.local` に設定する。
8. CognitoログインUIを接続後、`NEXT_PUBLIC_USE_MOCK_API=false` に変更する。

`.env.example` はGitの標準設定により除外されるため、必要な値はこの文書を参照して `.env.local` に作成します。

## セキュリティ上の注意

- AWSアクセスキー、Cognitoトークン、APIキーをGitへ保存しない。
- DynamoDBとS3は削除時も保持される設定になっている。
- 本番化前にAWS WAF、予算通知、CloudWatchアラーム、ログ保持期間を追加する。
- BedrockのモデルIDはデプロイ時パラメータで変更できる。
- 初期値はClaude Sonnet 4.5のJP inference profile。東京リージョンから呼び出し、処理先を東京・大阪に限定する。
