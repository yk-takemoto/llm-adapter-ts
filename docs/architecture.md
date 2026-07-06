# llm-adapter-ts アーキテクチャ・設計ドキュメント

> 対象バージョン: `@yk-takemoto/llm-adapter` 0.0.7（2026-07 時点の `org/llm-adapter-ts` ソース解析に基づく）

## 1. 概要

複数 LLM プロバイダ（OpenAI / Azure OpenAI / Anthropic / Google Gemini / Groq / Amazon Bedrock）を
統一インターフェースで扱うためのアダプタライブラリ。チャット（ツールコール対応）・音声認識・音声合成・
埋め込みの4機能を抽象化する。両アプリの「LLM 切り替え可能なエージェント」機能の中核。

- 利用元: `smarthome-agent-mcp/webui`、`kakeibo-agent/webui`、`kakeibo-agent/receipts_api`
- 配布形態: GitHub リポジトリ直参照（アプリごとに `#0.0.3` / `#0.0.7` / `#0.0.8` と**参照タグがばらついている**点に注意）

## 2. 全体アーキテクチャ

```text
llmAdapterHelper({ llmId })                  ← ファサード（プロバイダ選択 + 未サポート機能のフォールバック）
        │
        ▼
LlmAdapterBuilder（プロバイダ別 5 実装）
  openai_adapter.ts        (OpenAI / AzureOpenAI 兼用, 4機能フル実装)
  anthropic_adapter.ts     (chatCompletions のみ)
  gemini_adapter.ts        (chat / TTS / STT / embedding)
  groq_adapter.ts          (chat / STT / TTS)
  amazonbedrock_adapter.ts (chatCompletions のみ, Converse API)
        │  build()
        ▼
LlmAdapter = ChatCompletionsAdapter & Partial<SpeechToText & TextToSpeech & Embedding>
        │
        ▼
LlmClientBuilder（プロバイダ SDK クライアント生成。env から認証情報を解決）
```

### 機能インターフェース（`llm_adapter_schemas.ts`）

| 機能 | 引数（主要） | 戻り値 |
| --- | --- | --- |
| `chatCompletions` | `systemPrompt: string[]`, `newMessageContents`（text/image/audio）, `options.tools`（MCP Tool 形式）, `options.toolOption`（type: function / function_strict / response_format）, `inProgress`（継続会話 + toolResults） | `{ text, tools[]（tool_calls）, messages[]（履歴） }` |
| `speechToText` | `audioFilePath`, `options.language` | 文字列 |
| `textToSpeech` | `message`, `options.voice/responseFormat` | `{ contentType, content: Buffer }` |
| `embedding` | `text`, `options.dimensions` | `{ embedding: number[] }` |

### ツール形式は MCP Tool スキーマが正

`mcpToolSchema`（`{ name, description, inputSchema }`）を共通入力とし、各アダプタが
プロバイダ固有形式（OpenAI function calling / Anthropic tools / Gemini functionDeclarations /
Bedrock toolSpec）へ `convertTools()` で変換する。JSON Schema の方言差（`additionalProperties`
の要否等）もアダプタ内で吸収する（OpenAI strict モードでは付加、Gemini では除去）。

## 3. 設計思想・ポリシー

- **「会話状態はライブラリが持たない」**: `chatCompletions` は毎回 `messages` 履歴を返し、呼び出し側が
  `inProgress.messages` として次回渡す。ツール実行結果も `inProgress.toolResults` で渡す
  （エージェントループはアプリ側 = webui API ルートが回す）。
- **スキーマ注入型の引数設計**: 全関数が `{ args, argsSchema, config, configSchema }` を受け、
  デフォルト引数として「env 由来の設定値」と「既定 zod スキーマ」が入る。呼び出し時に `parse()` で実行時検証。
- **設定は env 変数規約**: `OPENAI_API_MODEL_CHAT` / `AZURE_OPENAI_API_DEPLOYMENT_CHAT` /
  `ANTHROPIC_API_MODEL_CHAT` 等、プロバイダ×機能ごとのモデル名を env で指定。
  API キーは `APP_SECRETS`（JSON文字列）→ 個別 env の順で解決。
- **未サポート機能のグレースフルデグラデーション**: helper 層で
  - `speechToText` 未対応 → `"unsupported"` を返す
  - `textToSpeech` 未対応 → 同梱の「ごめんなさい音声」（`sorry_audio_base64.ts`、mp3/wav/aac）を返す
  - `embedding` 未対応 → `{ embedding: [] }`
- **画像入力の正規化**: URL を受け取り、Anthropic/Bedrock ではフェッチして base64/bytes 化。
  履歴保存時には画像データを `"ommitted"` に置換してトークン膨張を防ぐ（`convertMessagesForHistory`）。

## 4. テスト

- 単体: `uttest_*.ts`（mocha + chai + sinon、SDK をスタブ）
- 結合: `ittest_*.ts`（実 API 呼び出し）
- `tests/sample_openai_realtime_*.ts` / `sample_gemini_liveapi.ts` + `vite.config.ts`:
  **Realtime API / Live API（WebRTC/WS）の実験コード**が同居（`rtctest` スクリプト）。本体未統合。

## 5. 既知の課題（リアーキ観点）

- **プロバイダ間のロジック重複**: メッセージ変換・履歴管理・ツール変換・エラーハンドリング・debug ログが
  5ファイルにコピー的に存在（計 ~1,500 行）。共通基底 + プロバイダ差分のみの構造に再設計余地大。
- **ストリーミング非対応**: 全機能が一括レスポンス。チャット UI の体感品質向上にはストリーミングが必須級。
- **`console.log` デバッグ出力が本番コードに常時混入**（メッセージ全文・レスポンス全文を出力）。
  秘匿情報がログに出るリスクもあり、ロガー抽象化が必要。
- **スキーマ注入型引数の複雑さ**: `argsSchema`/`configSchema` を外から差し替える利用実態はなく、
  型と実行時検証の二重管理コストだけが残っている。
- 各プロバイダ SDK は比較的新しい（openai v6 / @google/genai v1 / anthropic 0.71）が、
  **Vercel AI SDK 等の標準アダプタ層で置き換え可能性**を検討する価値がある（リアーキ論点）。
- アプリごとに参照タグが `0.0.3`〜`0.0.8` と分裂しており、挙動差異のリスクがある（モノレポ化で解消）。
- zod v3 系。`z.record(z.any())` 多用で型安全性が弱い箇所がある。
