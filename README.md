# 筋トレ記録アプリ

仕様書 [spec.md](spec.md) をベースに、React Native (Expo) でAndroid向けの個人利用アプリを実装しています。

## 実装済み機能

- 音声入力またはテキスト入力をGeminiで解析してトレーニング記録を作成
- 解析結果の複数レコード保存（例: 複数重量を分割）
- 日付未指定時は当日扱い
- 種目名の表記ゆれマッピング（例: ベンチ -> ベンチプレス）
- SQLiteへの履歴保存
- カレンダー付き履歴画面
- 種目/期間フィルター
- 履歴の編集・削除
- 編集時の音声入力解析
- 設定画面で種目の追加・編集・削除（重複チェックあり）
- 初期プリセット種目投入

## 技術構成

- React Native: Expo SDK 54
- DB: expo-sqlite (SQLite)
- AI: Gemini API (gemini-2.0-flash)
- 音声認識: expo-speech-recognition

## 前提

- macOS
- Android SDK / adb のセットアップ済み
- 実機 Pixel 10 をUSB接続または同一ネットワークで接続
- Gemini APIキー

## セットアップ

```bash
cd app
cp .env.example .env
# .env の EXPO_PUBLIC_GEMINI_API_KEY を設定
npm install
```

## Android開発ビルド手順

1. 初回ビルド（ネイティブプロジェクト生成 + インストール）

```bash
cd app
npm run android:dev
```

2. Metro起動（Dev Clientモード）

```bash
cd app
npm run start:dev
```

3. 実機でDev Clientを開き、Metroへ接続

- USB接続で認識確認: `adb devices`
- 接続できない場合は `adb reverse tcp:8081 tcp:8081` を実行

## 環境変数

- `EXPO_PUBLIC_GEMINI_API_KEY`: Gemini APIキー

補足: `app.json` の `expo.extra.geminiApiKey` は空文字のままにしてあります。通常は `.env` の `EXPO_PUBLIC_GEMINI_API_KEY` を使用してください。

## ディレクトリ

- `app/src/db`: SQLite初期化とCRUD
- `app/src/screens`: 記録 / 履歴 / 設定画面
- `app/src/services/geminiService.ts`: Gemini解析
- `app/src/hooks/useSpeechToText.ts`: 音声入力

## 注意事項

- 音声認識は開発ビルド前提です（Expo GoではなくDev Clientを想定）。
- Gemini APIキー未設定時は解析機能が動作しません。
