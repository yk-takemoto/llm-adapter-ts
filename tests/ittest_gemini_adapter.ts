import { expect } from "chai";
import * as dotenv from "dotenv";
import { geminiAdapterBuilder } from "../src/gemini_adapter";
import { McpTool } from "../src/llm_adapter_schemas";

// テスト環境変数をロード
dotenv.config({ path: ".env.test" });

// APIキーが設定されているか確認
const requireEnvVars = ["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT"];

function checkEnvVars() {
  const missingVars = requireEnvVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、一部のテストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
}

describe("Gemini API 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(30000);

  const hasAllEnvVars = checkEnvVars();

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

  after(() => {
    // テスト後のクリーンアップは必要に応じて実装
    // ここでは一時ファイルを残しておく（デバッグ用）
  });
});
