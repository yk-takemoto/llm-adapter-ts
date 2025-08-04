import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { groqAdapterBuilder } from "../src/groq_adapter";
import { McpTool } from "../src/llm_adapter_schemas";

// テスト環境変数をロード
dotenv.config({ path: ".env.test" });

// APIキーが設定されているか確認
const requireEnvVars = ["GROQ_API_KEY", "GROQ_API_MODEL_CHAT"];
const requireEnvVarsWithAudio = ["GROQ_API_KEY", "GROQ_API_MODEL_AUDIO_TRANSCRIPTION", "GROQ_API_MODEL_TEXT2SPEECH"];

function checkEnvVars() {
  const missingVars = requireEnvVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、一部のテストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
}

function checkEnvVarsWithAudio() {
  const missingVars = requireEnvVarsWithAudio.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、音声関連テストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
}

// テスト用の一時ディレクトリ作成
const testTmpDir = path.join(__dirname, "../.test_tmp");
if (!fs.existsSync(testTmpDir)) {
  fs.mkdirSync(testTmpDir, { recursive: true });
}

describe("Groq API 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(30000);

  const hasAllEnvVars = checkEnvVars();
  const hasAudioEnvVars = checkEnvVarsWithAudio();

  before(() => {
    // 必要な環境変数をセット
  });

  describe("chatCompletions インテグレーションテスト", () => {
    it("通常のテキスト会話が正しく処理されること", async function () {
      if (!hasAllEnvVars) this.skip();

      const groqAdapter = groqAdapterBuilder.build();
      const result = await groqAdapter.chatCompletions({
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

      const groqAdapter = groqAdapterBuilder.build();
      const result = await groqAdapter.chatCompletions({
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

    it("環境パラメータ直接指定によるchatCompletions呼び出し", async function () {
      if (!hasAllEnvVars) this.skip();

      const groqAdapter = groqAdapterBuilder.build({
        buildClientInputParams: {
          args: {
            apiKey: process.env.GROQ_API_KEY || "",
          },
        },
      });
      const result = await groqAdapter.chatCompletions({
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
        config: {
          apiModelChat: process.env.GROQ_API_MODEL_CHAT,
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      expect(result?.tools).to.be.an("array").and.to.be.empty;

      console.log(`回答: ${result?.text}`);
    });
  });

  describe("speechToText インテグレーションテスト", () => {
    let testAudioPath: string;

    before(async function () {
      if (!hasAudioEnvVars) this.skip();

      // テスト用音声ファイルの作成（テキスト→音声変換で作成）
      testAudioPath = path.join(testTmpDir, "test_audio_groq.wav");

      try {
        const groqAdapter = groqAdapterBuilder.build();
        const ttsResult = await groqAdapter.textToSpeech!({
          args: {
            message: "This is a test of Groq text to speech.",
            options: {
              voice: "Aaliyah-PlayAI",
              responseFormat: "wav",
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
      if (!hasAudioEnvVars || !fs.existsSync(testAudioPath)) {
        this.skip();
      }

      const groqAdapter = groqAdapterBuilder.build();
      const result = await groqAdapter.speechToText!({
        args: {
          audioFilePath: testAudioPath,
          options: {
            language: "en",
          },
        },
      });

      expect(result).to.be.a("string").and.to.not.be.empty;
      expect(result?.toLowerCase()).to.include("test");

      console.log(`音声認識結果: ${result}`);
    });
  });

  describe("textToSpeech インテグレーションテスト", () => {
    it("テキストから音声への変換が正しく行われること", async function () {
      if (!hasAudioEnvVars) this.skip();

      const groqAdapter = groqAdapterBuilder.build();
      const testMessage = "This is a Groq text-to-speech test.";
      const result = await groqAdapter.textToSpeech!({
        args: {
          message: testMessage,
          options: {
            voice: "Aaliyah-PlayAI",
            responseFormat: "wav",
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.include("audio");
      expect(Buffer.isBuffer(result?.content)).to.be.true;
      expect(result?.content.length).to.be.greaterThan(1000); // 音声データの最小サイズを確認

      // テスト結果の音声を保存（オプション）
      const outputPath = path.join(testTmpDir, "test_output_groq.wav");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル: ${outputPath}`);
    });
  });

  after(() => {
    // テスト後のクリーンアップは必要に応じて実装
    // ここでは一時ファイルを残しておく（デバッグ用）
  });
});
