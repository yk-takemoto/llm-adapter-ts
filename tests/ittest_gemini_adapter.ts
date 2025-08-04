import { expect } from "chai";
import * as dotenv from "dotenv";
import { geminiAdapterBuilder } from "../src/gemini_adapter";
import { McpTool } from "../src/llm_adapter_schemas";

// テスト環境変数をロード
dotenv.config({ path: ".env.test" });

// APIキーが設定されているか確認
const requireEnvVars = ["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT"];
const requireEnvVarsWithEmbedding = ["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT", "GEMINI_API_MODEL_EMBEDDING"];

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

describe("Gemini API 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(30000);

  const hasAllEnvVars = checkEnvVars();
  const hasEmbeddingEnvVars = checkEnvVarsWithEmbedding();

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
              maxTokens: 200,
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
            maxTokens: 200,
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
