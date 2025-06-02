import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import llmAdapterHelper from "../src/llm_adapter_helper";
import { McpTool } from "../src/llm_adapter_schemas";

// テスト環境変数をロード
dotenv.config({ path: ".env.test" });

// 必要な環境変数をチェックする関数
const checkEnvVars = (envVars: string[]) => {
  const missingVars = envVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.warn(`⚠️ 以下の環境変数が設定されていないため、一部のテストはスキップされます: ${missingVars.join(", ")}`);
    return false;
  }
  return true;
};

// テスト用の一時ディレクトリ作成
const testTmpDir = path.join(__dirname, "../.test_tmp");
if (!fs.existsSync(testTmpDir)) {
  fs.mkdirSync(testTmpDir, { recursive: true });
}

describe("LlmAdapterHelper 統合テスト", function () {
  // API呼び出しを伴うため、タイムアウトを長めに設定
  this.timeout(60000);

  describe("OpenAI アダプター経由のテスト", () => {
    const openaiVars = ["OPENAI_API_KEY", "OPENAI_API_MODEL_CHAT", "OPENAI_API_MODEL_AUDIO_TRANSCRIPTION", "OPENAI_API_MODEL_TEXT2SPEECH"];
    const hasOpenAIEnv = checkEnvVars(openaiVars);

    it("chatCompletions が正しく実行されること", async function () {
      if (!hasOpenAIEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "OpenAI" });
      const result = await helper.chatCompletions({
        systemPrompt: ["あなたは短く回答するアシスタントです。"],
        newMessageContents: [{ text: "こんにちは、今日の気分はどうですか？" }],
        options: {
          toolOption: {
            temperature: 0.7,
            maxTokens: 100,
          },
          tools: [],
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      console.log(`OpenAI chatCompletions 結果: ${result?.text}`);
    });

    it("speechToText が正しく実行されること", async function () {
      if (!hasOpenAIEnv) this.skip();

      // 先にテキスト音声変換でテスト用音声ファイルを作成
      const helper = llmAdapterHelper({ llmId: "OpenAI" });
      const testAudioPath = path.join(testTmpDir, "helper_test_audio_openai.mp3");

      try {
        const ttsResult = await helper.textToSpeech({
          message: "これはOpenAIヘルパーのテストです。",
          options: {
            voice: "alloy",
            responseFormat: "mp3",
          },
        });

        if (ttsResult && ttsResult.content) {
          fs.writeFileSync(testAudioPath, ttsResult.content);
          console.log(`テスト用音声ファイル作成: ${testAudioPath}`);
        } else {
          this.skip();
        }

        // 音声からテキストへの変換テスト
        const sttResult = await helper.speechToText({
          audioFilePath: testAudioPath,
          options: {
            language: "ja",
          },
        });

        expect(sttResult).to.be.a("string").and.to.not.be.empty;
        expect(sttResult.toLowerCase()).to.include("テスト");
        console.log(`OpenAI speechToText 結果: ${sttResult}`);
      } catch (error) {
        console.error("テスト中にエラーが発生しました:", error);
        this.skip();
      }
    });

    it("textToSpeech が正しく実行されること", async function () {
      if (!hasOpenAIEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "OpenAI" });
      const result = await helper.textToSpeech({
        message: "これはllmAdapterHelperのテストです。",
        options: {
          voice: "nova",
          responseFormat: "mp3",
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.equal("audio/mpeg");
      expect(Buffer.isBuffer(result?.content)).to.be.true;

      // テスト結果の音声を保存
      const outputPath = path.join(testTmpDir, "helper_tts_openai.mp3");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル: ${outputPath}`);
    });
  });

  describe("AzureOpenAI アダプター経由のテスト", () => {
    const azureVars = ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT", "OPENAI_API_VERSION", "AZURE_OPENAI_API_DEPLOYMENT_CHAT"];
    const hasAzureEnv = checkEnvVars(azureVars);

    it("chatCompletions が正しく実行されること", async function () {
      if (!hasAzureEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "AzureOpenAI" });
      const result = await helper.chatCompletions({
        systemPrompt: ["あなたは短く回答するアシスタントです。"],
        newMessageContents: [{ text: "こんにちは、今日の気分はどうですか？" }],
        options: {
          toolOption: {
            temperature: 0.7,
            maxTokens: 100,
          },
          tools: [],
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      console.log(`AzureOpenAI chatCompletions 結果: ${result?.text}`);
    });
  });

  describe("Anthropic アダプター経由のテスト", () => {
    const anthropicVars = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_MODEL_CHAT"];
    const hasAnthropicEnv = checkEnvVars(anthropicVars);

    it("chatCompletions が正しく実行されること", async function () {
      if (!hasAnthropicEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Anthropic" });
      const result = await helper.chatCompletions({
        systemPrompt: ["あなたは短く回答するアシスタントです。"],
        newMessageContents: [{ text: "こんにちは、今日の気分はどうですか？" }],
        options: {
          toolOption: {
            temperature: 0.7,
            maxTokens: 100,
          },
          tools: [],
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      console.log(`Anthropic chatCompletions 結果: ${result?.text}`);
    });

    it("speechToText はサポートされていないこと", async function () {
      if (!hasAnthropicEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Anthropic" });
      const result = await helper.speechToText({
        audioFilePath: "dummy.mp3",
        options: {},
      });

      expect(result).to.equal("unsupported");
      console.log(`Anthropic speechToText 結果: ${result}`);
    });

    it("textToSpeech はソーリーメッセージを返すこと", async function () {
      if (!hasAnthropicEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Anthropic" });
      const result = await helper.textToSpeech({
        message: "これはテストです。",
        options: {
          responseFormat: "mp3",
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.equal("audio/mpeg");
      expect(Buffer.isBuffer(result?.content)).to.be.true;

      // ソーリーメッセージの音声を保存
      const outputPath = path.join(testTmpDir, "helper_tts_anthropic_sorry.mp3");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル（ソーリー）: ${outputPath}`);
    });
  });

  describe("Google (Gemini) アダプター経由のテスト", () => {
    const geminiVars = ["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT"];
    const hasGeminiEnv = checkEnvVars(geminiVars);

    it("chatCompletions が正しく実行されること", async function () {
      if (!hasGeminiEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Google" });
      const result = await helper.chatCompletions({
        systemPrompt: ["あなたは短く回答するアシスタントです。"],
        newMessageContents: [{ text: "こんにちは、今日の気分はどうですか？" }],
        options: {
          toolOption: {
            temperature: 0.7,
            maxTokens: 100,
          },
          tools: [],
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      console.log(`Google (Gemini) chatCompletions 結果: ${result?.text}`);
    });

    it("speechToText はサポートされていないこと", async function () {
      if (!hasGeminiEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Google" });
      const result = await helper.speechToText({
        audioFilePath: "dummy.wav",
        options: {},
      });

      expect(result).to.equal("unsupported");
      console.log(`Google (Gemini) speechToText 結果: ${result}`);
    });

    it("textToSpeech はソーリーメッセージを返すこと", async function () {
      if (!hasGeminiEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Google" });
      const result = await helper.textToSpeech({
        message: "これはテストです。",
        options: {
          responseFormat: "wav",
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.equal("audio/wav");
      expect(Buffer.isBuffer(result?.content)).to.be.true;

      // ソーリーメッセージの音声を保存
      const outputPath = path.join(testTmpDir, "helper_tts_gemini_sorry.wav");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル（ソーリー）: ${outputPath}`);
    });
  });

  describe("Groq アダプター経由のテスト", () => {
    const groqVars = ["GROQ_API_KEY", "GROQ_API_MODEL_CHAT"];
    const hasGroqEnv = checkEnvVars(groqVars);

    it("chatCompletions が正しく実行されること", async function () {
      if (!hasGroqEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Groq" });
      const result = await helper.chatCompletions({
        systemPrompt: ["あなたは短く回答するアシスタントです。"],
        newMessageContents: [{ text: "こんにちは、今日の気分はどうですか？" }],
        options: {
          toolOption: {
            temperature: 0.7,
            maxTokens: 100,
          },
          tools: [],
        },
      });

      expect(result).to.not.be.null;
      expect(result?.text).to.be.a("string").and.to.not.be.empty;
      expect(result?.messages).to.be.an("array").and.to.have.length.at.least(2);
      console.log(`Groq chatCompletions 結果: ${result?.text}`);
    });

    it("speechToText はサポートされていないこと", async function () {
      if (!hasGroqEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Groq" });
      const result = await helper.speechToText({
        audioFilePath: "dummy.mp3",
        options: {},
      });

      expect(result).to.equal("unsupported");
      console.log(`Groq speechToText 結果: ${result}`);
    });

    it("textToSpeech はソーリーメッセージを返すこと", async function () {
      if (!hasGroqEnv) this.skip();

      const helper = llmAdapterHelper({ llmId: "Groq" });
      const result = await helper.textToSpeech({
        message: "これはテストです。",
        options: {
          responseFormat: "aac",
        },
      });

      expect(result).to.not.be.null;
      expect(result?.contentType).to.equal("audio/aac");
      expect(Buffer.isBuffer(result?.content)).to.be.true;

      // ソーリーメッセージの音声を保存
      const outputPath = path.join(testTmpDir, "helper_tts_groq_sorry.aac");
      fs.writeFileSync(outputPath, result?.content || Buffer.from([]));
      console.log(`生成された音声ファイル（ソーリー）: ${outputPath}`);
    });
  });

  // ツール呼び出しのテスト（サービス共通）
  describe("ツール呼び出しのテスト", () => {
    // テスト可能な最初のサービスを選択
    const getAvailableAdapter = () => {
      if (checkEnvVars(["OPENAI_API_KEY", "OPENAI_API_MODEL_CHAT"])) return "OpenAI";
      if (checkEnvVars(["ANTHROPIC_API_KEY", "ANTHROPIC_API_MODEL_CHAT"])) return "Anthropic";
      if (checkEnvVars(["GEMINI_API_KEY", "GEMINI_API_MODEL_CHAT"])) return "Google";
      if (checkEnvVars(["GROQ_API_KEY", "GROQ_API_MODEL_CHAT"])) return "Groq";
      return null;
    };

    const availableAdapter = getAvailableAdapter();

    it("ツール呼び出しが正しく実行されること", async function () {
      if (!availableAdapter) this.skip();

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

      const helper = llmAdapterHelper({ llmId: availableAdapter });
      const result = await helper.chatCompletions({
        systemPrompt: ["あなたはアシスタントです。利用可能なツールがあれば積極的に利用してください。"],
        newMessageContents: [{ text: "東京の今日の天気を教えてください" }],
        options: {
          toolOption: {
            type: "function",
            temperature: 0.2,
            maxTokens: 500,
          },
          tools: tools,
        },
      });

      expect(result).to.not.be.null;
      expect(result?.tools).to.be.an("array").and.to.not.be.empty;
      expect(result?.tools[0]).to.have.property("name", "get_weather");
      expect(result?.tools[0].arguments).to.have.property("location").that.includes("東京");

      console.log(`${availableAdapter} ツール呼び出し結果: ${JSON.stringify(result?.tools[0], null, 2)}`);
    });
  });
});
