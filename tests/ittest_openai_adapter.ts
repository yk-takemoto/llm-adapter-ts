import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { openAIAdapterBuilder } from "../src/openai_adapter";
import { McpTool } from "../src/llm_adapter_schemas";

// テスト環境変数をロード
dotenv.config({ path: ".env.test" });

// APIキーが設定されているか確認
const requireEnvVarsWithOpenAI = ["OPENAI_API_KEY", "OPENAI_API_MODEL_CHAT", "OPENAI_API_MODEL_AUDIO_TRANSCRIPTION", "OPENAI_API_MODEL_TEXT2SPEECH"];
const requireEnvVarsWithAzureOpenAI = [
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "OPENAI_API_VERSION",
  "AZURE_OPENAI_API_DEPLOYMENT_CHAT",
  "AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION",
  "AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH",
];

function checkEnvVarsWithOpenAI() {
  const missingVars = requireEnvVarsWithOpenAI.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、一部のテストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
}

function checkEnvVarsWithAzureOpenAI() {
  const missingVars = requireEnvVarsWithAzureOpenAI.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、一部のテストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
}

// テスト用の一時ディレクトリ作成
const testTmpDir = path.join(__dirname, "../.test_tmp");
if (!fs.existsSync(testTmpDir)) {
  fs.mkdirSync(testTmpDir, { recursive: true });
}

describe("OpenAI API 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(30000);

  const hasAllEnvVars = checkEnvVarsWithOpenAI();

  before(() => {
    // 必要な環境変数をセット
  });

  describe("chatCompletions インテグレーションテスト", () => {
    it("通常のテキスト会話が正しく処理されること", async function () {
      if (!hasAllEnvVars) this.skip();

      const openAIAdapter = openAIAdapterBuilder.build();
      const result = await openAIAdapter.chatCompletions({
        args: {
          systemPrompt: ["あなたは日本語でサポートするアシスタントです。短く回答してください。"],
          newMessageContents: [{ text: "今日の東京の天気はどうですか？" }],
          options: {
            toolOption: {
              temperature: 0.7,
              maxTokens: 200,
            },
            tools: [],
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      expect(result?.tools).to.be.an("array").and.to.be.empty;

      console.log(`回答: ${result?.text}`);
    });

    it("ツール呼び出しが正しく処理されること", async function () {
      if (!hasAllEnvVars) this.skip();

      const tools: McpTool[] = [
        {
          name: "get_weather",
          description: "指定された場所の天気情報を取得します。location（場所）は必須パラメータです。",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string", description: "天気情報を取得したい場所（都市名など）" },
              unit: { type: "string", enum: ["celsius", "fahrenheit"], description: "温度の単位" },
            },
            required: ["location"],
          },
        },
      ];

      const openAIAdapter = openAIAdapterBuilder.build();
      const result = await openAIAdapter.chatCompletions({
        args: {
          systemPrompt: ["あなたは日本語でサポートするアシスタントです。利用可能なツールがあれば積極的に利用してください。"],
          newMessageContents: [{ text: "東京の今日の天気を教えてください" }],
          options: {
            toolOption: {
              type: "function",
              temperature: 0.2,
              maxTokens: 500,
            },
            tools: tools,
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.tools).to.be.an("array").and.to.not.be.empty;
      expect(result?.tools[0]).to.have.property("name", "get_weather");
      expect(result?.tools[0].arguments).to.have.property("location").that.includes("東京");

      console.log(`ツール呼び出し: ${JSON.stringify(result?.tools[0], null, 2)}`);
    });
  });

  describe("speechToText インテグレーションテスト", () => {
    let testAudioPath: string;

    before(async function () {
      if (!hasAllEnvVars) this.skip();

      // テスト用音声ファイルの作成（テキスト→音声変換で作成）
      testAudioPath = path.join(testTmpDir, "test_audio_openai.mp3");

      try {
        const openAIAdapter = openAIAdapterBuilder.build();
        const ttsResult = await openAIAdapter.textToSpeech!({
          args: {
            message: "これはOpenAIテキスト音声変換のテストです。",
            options: {
              voice: "alloy",
              responseFormat: "mp3",
            },
          },
        });

        if (ttsResult && ttsResult.content) {
          fs.writeFileSync(testAudioPath, ttsResult.content);
          console.log(`テスト用音声ファイル作成: ${testAudioPath}`);
        } else {
          this.skip();
        }
      } catch (error) {
        console.error("テスト用音声ファイルの作成に失敗しました", error);
        this.skip();
      }
    });

    it("音声からテキストへの変換が正しく行われること", async function () {
      if (!hasAllEnvVars || !fs.existsSync(testAudioPath)) {
        this.skip();
      }

      const openAIAdapter = openAIAdapterBuilder.build();
      const result = await openAIAdapter.speechToText!({
        args: {
          audioFilePath: testAudioPath,
          options: {
            language: "ja",
          },
        },
      });

      expect(result).to.be.a("string").and.to.not.be.empty;
      expect(result?.toLowerCase()).to.include("テスト");

      console.log(`音声認識結果: ${result}`);
    });
  });

  describe("textToSpeech インテグレーションテスト", () => {
    it("テキストから音声への変換が正しく行われること", async function () {
      if (!hasAllEnvVars) this.skip();

      const openAIAdapter = openAIAdapterBuilder.build();
      const testMessage = "これはOpenAIのテキスト音声変換テストです。";
      const result = await openAIAdapter.textToSpeech!({
        args: {
          message: testMessage,
          options: {
            voice: "nova",
            responseFormat: "mp3",
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.equal("audio/mpeg");
      expect(Buffer.isBuffer(result?.content)).to.be.true;
      expect(result?.content.length).to.be.greaterThan(1000); // 音声データの最小サイズを確認

      // テスト結果の音声を保存（オプション）
      const outputPath = path.join(testTmpDir, "test_output_openai.mp3");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル: ${outputPath}`);
    });
  });

  after(() => {
    // テスト後のクリーンアップは必要に応じて実装
    // ここでは一時ファイルを残しておく（デバッグ用）
  });
});

describe("Azure OpenAI API 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(30000);

  const hasAllEnvVars = checkEnvVarsWithAzureOpenAI();

  before(() => {
    // 必要な環境変数をセット
  });

  describe("chatCompletions インテグレーションテスト", () => {
    it("通常のテキスト会話が正しく処理されること", async function () {
      if (!hasAllEnvVars) this.skip();

      const openAIAdapter = openAIAdapterBuilder.build({ args: "AzureOpenAI" });
      const result = await openAIAdapter.chatCompletions({
        args: {
          systemPrompt: ["あなたは日本語でサポートするアシスタントです。短く回答してください。"],
          newMessageContents: [{ text: "今日の東京の天気はどうですか？" }],
          options: {
            toolOption: {
              temperature: 0.7,
              maxTokens: 200,
            },
            tools: [],
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      expect(result?.tools).to.be.an("array").and.to.be.empty;

      console.log(`回答: ${result?.text}`);
    });

    it("ツール呼び出しが正しく処理されること", async function () {
      if (!hasAllEnvVars) this.skip();

      const tools: McpTool[] = [
        {
          name: "get_weather",
          description: "指定された場所の天気情報を取得します。location（場所）は必須パラメータです。",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string", description: "天気情報を取得したい場所（都市名など）" },
              unit: { type: "string", enum: ["celsius", "fahrenheit"], description: "温度の単位" },
            },
            required: ["location"],
          },
        },
      ];

      const openAIAdapter = openAIAdapterBuilder.build({ args: "AzureOpenAI" });
      const result = await openAIAdapter.chatCompletions({
        args: {
          systemPrompt: ["あなたは日本語でサポートするアシスタントです。利用可能なツールがあれば積極的に利用してください。"],
          newMessageContents: [{ text: "東京の今日の天気を教えてください" }],
          options: {
            toolOption: {
              type: "function",
              temperature: 0.2,
              maxTokens: 500,
            },
            tools: tools,
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.tools).to.be.an("array").and.to.not.be.empty;
      expect(result?.tools[0]).to.have.property("name", "get_weather");
      expect(result?.tools[0].arguments).to.have.property("location").that.includes("東京");

      console.log(`ツール呼び出し: ${JSON.stringify(result?.tools[0], null, 2)}`);
    });
  });

  describe("speechToText インテグレーションテスト", () => {
    let testAudioPath: string;

    before(async function () {
      if (!hasAllEnvVars) this.skip();

      // テスト用音声ファイルの作成（テキスト→音声変換で作成）
      testAudioPath = path.join(testTmpDir, "test_audio_aoai.mp3");

      try {
        // 音声読み上げは最新のAPIバージョンには対応していないので旧バージョン指定
        process.env.OPENAI_API_VERSION = "2024-08-01-preview";
        const openAIAdapter = openAIAdapterBuilder.build({ args: "AzureOpenAI" });
        const ttsResult = await openAIAdapter.textToSpeech!({
          args: {
            message: "これはAzureOpenAIテキスト音声変換のテストです。",
            options: {
              voice: "alloy",
              responseFormat: "mp3",
            },
          },
        });

        if (ttsResult && ttsResult.content) {
          fs.writeFileSync(testAudioPath, ttsResult.content);
          console.log(`テスト用音声ファイル作成: ${testAudioPath}`);
        } else {
          this.skip();
        }
      } catch (error) {
        console.error("テスト用音声ファイルの作成に失敗しました", error);
        this.skip();
      }
    });

    it("音声からテキストへの変換が正しく行われること", async function () {
      if (!hasAllEnvVars || !fs.existsSync(testAudioPath)) {
        this.skip();
      }

      // 文字お越しは最新のAPIバージョンを指定
      process.env.OPENAI_API_VERSION = "2025-03-01-preview";
      const openAIAdapter = openAIAdapterBuilder.build({ args: "AzureOpenAI" });
      const result = await openAIAdapter.speechToText!({
        args: {
          audioFilePath: testAudioPath,
          options: {
            language: "ja",
          },
        },
      });

      expect(result).to.be.a("string").and.to.not.be.empty;
      expect(result?.toLowerCase()).to.include("テスト");

      console.log(`音声認識結果: ${result}`);
    });
  });

  describe("textToSpeech インテグレーションテスト", () => {
    it("テキストから音声への変換が正しく行われること", async function () {
      if (!hasAllEnvVars) this.skip();

      // 音声読み上げは最新のAPIバージョンには対応していないので旧バージョン指定
      process.env.OPENAI_API_VERSION = "2024-08-01-preview";
      const openAIAdapter = openAIAdapterBuilder.build({ args: "AzureOpenAI" });
      const testMessage = "これはAzureOpenAIのテキスト音声変換テストです。";
      const result = await openAIAdapter.textToSpeech!({
        args: {
          message: testMessage,
          options: {
            voice: "nova",
            responseFormat: "mp3",
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.equal("audio/mpeg");
      expect(Buffer.isBuffer(result?.content)).to.be.true;
      expect(result?.content.length).to.be.greaterThan(1000); // 音声データの最小サイズを確認

      // テスト結果の音声を保存（オプション）
      const outputPath = path.join(testTmpDir, "test_output_aoai.mp3");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル: ${outputPath}`);
    });
  });

  after(() => {
    // テスト後のクリーンアップは必要に応じて実装
    // ここでは一時ファイルを残しておく（デバッグ用）
  });
});
