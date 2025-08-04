import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { geminiAdapterBuilder } from "../src/gemini_adapter";
import { McpTool } from "../src/llm_adapter_schemas";

// テスト環境変数をロード
dotenv.config({ path: ".env.test" });

// APIキーが設定されているか確認
const requireEnvVars = ["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT"];
const requireEnvVarsWithEmbedding = ["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT", "GEMINI_API_MODEL_EMBEDDING"];
const requireEnvVarsWithAudio = ["GEMINI_API_KEY", "GEMINI_API_MODEL_AUDIO_TRANSCRIPTION", "GEMINI_API_MODEL_TEXT2SPEECH"];

function checkEnvVars() {
  const missingVars = requireEnvVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、一部のテストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
}

function checkEnvVarsWithEmbedding() {
  const missingVars = requireEnvVarsWithEmbedding.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、embeddingテストはスキップされます: ${missingVars.join(", ")}`);
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

describe("Gemini API 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(30000);

  const hasAllEnvVars = checkEnvVars();
  const hasEmbeddingEnvVars = checkEnvVarsWithEmbedding();
  const hasAudioEnvVars = checkEnvVarsWithAudio();

  before(() => {
    // 必要な環境変数をセット
  });

  describe("chatCompletions インテグレーションテスト", () => {
    it("通常のテキスト会話が正しく処理されること", async function () {
      if (!hasAllEnvVars) this.skip();

      const geminiAdapter = geminiAdapterBuilder.build();
      const result = await geminiAdapter.chatCompletions({
        args: {
          systemPrompt: ["あなたは日本語でサポートするアシスタントです。短く回答してください。"],
          newMessageContents: [{ text: "今日の東京の天気はどうですか？" }],
          options: {
            toolOption: {
              temperature: 0.7,
              maxTokens: 500,
            },
            tools: [],
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(1);
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

      const geminiAdapter = geminiAdapterBuilder.build();
      const result = await geminiAdapter.chatCompletions({
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

  it("環境パラメータ直接指定によるchatCompletions呼び出し", async function () {
    if (!hasAllEnvVars) this.skip();

    const geminiAdapter = geminiAdapterBuilder.build({
      buildClientInputParams: {
        args: {
          apiKey: process.env.GEMINI_API_KEY || "",
        },
      },
    });
    const result = await geminiAdapter.chatCompletions({
      args: {
        systemPrompt: ["あなたは日本語でサポートするアシスタントです。短く回答してください。"],
        newMessageContents: [{ text: "今日の東京の天気はどうですか？" }],
        options: {
          toolOption: {
            temperature: 0.7,
            maxTokens: 500,
          },
          tools: [],
        },
      },
      config: {
        apiModelChat: process.env.GEMINI_API_MODEL_CHAT,
      },
    });

    expect(result).to.not.be.null;
    expect(result?.text).to.be.a("string").and.to.not.be.empty;
    expect(result?.messages).to.be.an("array").and.to.have.length.at.least(1);
    expect(result?.tools).to.be.an("array").and.to.be.empty;

    console.log(`回答: ${result?.text}`);
  });

  describe("speechToText インテグレーションテスト", () => {
    let testAudioPath: string;

    before(async function () {
      if (!hasAudioEnvVars) this.skip();

      // テスト用音声ファイルの作成（テキスト→音声変換で作成）
      testAudioPath = path.join(testTmpDir, "test_audio_gemini.wav");

      try {
        const geminiAdapter = geminiAdapterBuilder.build();
        const ttsResult = await geminiAdapter.textToSpeech!({
          args: {
            message: "これはGeminiテキスト音声変換のテストです。",
            options: {
              voice: "Kore",
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

      const geminiAdapter = geminiAdapterBuilder.build();
      const result = await geminiAdapter.speechToText!({
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
      if (!hasAudioEnvVars) this.skip();

      const geminiAdapter = geminiAdapterBuilder.build();
      const testMessage = "これはGeminiのテキスト音声変換テストです。";
      const result = await geminiAdapter.textToSpeech!({
        args: {
          message: testMessage,
          options: {
            voice: "Kore",
            responseFormat: "wav",
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.include("audio");
      expect(Buffer.isBuffer(result?.content)).to.be.true;
      expect(result?.content.length).to.be.greaterThan(1000); // 音声データの最小サイズを確認

      // テスト結果の音声を保存（オプション）
      const outputPath = path.join(testTmpDir, "test_output_gemini.wav");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル: ${outputPath}`);
    });
  });

  describe("embedding インテグレーションテスト", () => {
    it("テキストのembeddingが正しく処理されること（optionsなし）", async function () {
      if (!hasEmbeddingEnvVars) this.skip();

      const geminiAdapter = geminiAdapterBuilder.build();
      const testText = "これはGeminiのembedding APIのテストです。";

      const result = await geminiAdapter.embedding!({
        args: {
          text: testText,
          options: {},
        },
      });

      expect(result).to.not.be.null;
      expect(result?.embedding).to.be.an("array").and.to.have.length.greaterThan(0);
      expect(result?.embedding[0]).to.be.a("number");

      console.log(`Embedding次元数: ${result?.embedding.length}`);
      console.log(`最初の5次元: ${result?.embedding.slice(0, 5)}`);
    });

    it("テキストのembeddingが正しく処理されること（optionsあり）", async function () {
      if (!hasEmbeddingEnvVars) this.skip();

      const geminiAdapter = geminiAdapterBuilder.build();
      const testText = "これはGeminiのembedding APIのテストです。";

      const result = await geminiAdapter.embedding!({
        args: {
          text: testText,
          options: {
            dimensions: 512,
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result?.embedding).to.be.an("array");
      expect(result?.embedding[0]).to.be.a("number");

      console.log(`指定した次元数: 512, 実際の次元数: ${result?.embedding.length}`);
    });

    it("無効なモデル指定時にエラーが発生すること", async function () {
      if (!hasEmbeddingEnvVars) this.skip();

      const geminiAdapter = geminiAdapterBuilder.build();
      const testText = "これはエラーテストです。";

      try {
        await geminiAdapter.embedding!({
          args: {
            text: testText,
            options: {},
          },
          config: {
            apiModelEmbedding: "invalid-model-name",
          },
        });
        // エラーが発生しなかった場合はテスト失敗
        expect.fail("エラーが発生するはずです");
      } catch (error) {
        expect(error).to.be.an("error");
        console.log(`期待通りエラーが発生: ${(error as Error).message}`);
      }
    });
  });

  after(() => {
    // テスト後のクリーンアップは必要に応じて実装
    // ここでは一時ファイルを残しておく（デバッグ用）
  });
});
