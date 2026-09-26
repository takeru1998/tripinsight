# TripInsight TestFlight 外部テスト

## 準備済み

- iOS Bundle ID: `com.tripcheck.app`
- 表示名: `TripInsight`
- バージョン: `1.0`
- 対象: iPhone / iOS 15以上 / 縦画面
- Capacitor iOSプロジェクト: `ios/App/App.xcodeproj`
- Codemagic workflow: `ios-testflight`
- App Store Connect APIキー: SwingVisionと同じ `app_store_connect` グループを利用
- AWS API: `https://localhost` からのCORS通信を許可

## Apple側で必要な作業

1. Apple DeveloperのCertificates, Identifiers & ProfilesでApp ID `com.tripcheck.app` を登録する。
2. App Store Connectの「マイApp」で新規Appを作成する。
3. 名前を `TripInsight`、Bundle IDを `com.tripcheck.app`、SKUを `tripinsight-ios` にする。
4. GitHubの `takeru1998/tripinsight` にこのプロジェクトをpushする。
5. CodemagicでGitHubリポジトリを追加する。
6. SwingVisionで使用中の環境変数グループ `app_store_connect` を同じチーム内で利用できることを確認する。
7. Codemagicの `TripInsight iOS TestFlight` を実行する。

## 外部テスト開始

1. App Store ConnectのTestFlightでアップロードされたビルドの処理完了を待つ。
2. 輸出コンプライアンスの質問には、アプリ独自の暗号化を実装していない場合、その内容に沿って回答する。
3. 「外部テスト」からテスターグループを作成する。
4. テスト情報、連絡先、審査用ログイン情報を入力する。
5. ビルドを追加して「ベータ版App Reviewへ提出」を実行する。
6. 承認後、公開リンクまたはメール招待でテスターへ配布する。

外部テスターはAppleのベータ版審査完了後に参加できます。内部テスターは審査を待たずに確認できます。
