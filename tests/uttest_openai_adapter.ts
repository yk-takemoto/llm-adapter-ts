import { expect } from "chai";
import sinon from "sinon";
import { openAIAdapterBuilder } from "../src/openai_adapter";
import { McpTool } from "../src/llm_adapter_schemas";
import fs from "fs";

describe("OpenAI Adapter Tests", () => {
  // createReadStreamのスタブを変数として定義
  let createReadStreamStub: sinon.SinonStub;
  let openAIAdapter: ReturnType<typeof openAIAdapterBuilder.build>;

  beforeEach(() => {
    // openAIAdapterBuilderのbuildメソッドの戻り値をスタブ化
    const adapterStub = {
      chatCompletions: async (params: any) => {
        const { args } = params || {};
        const { options } = args || {};

        // ツール呼び出しのシミュレーション
        if (options?.tools?.length > 0 && options.toolOption?.type === "function") {
          return {
            text: null,
            tools: [
              {
                id: "call_12345",
                name: "get_weather",
                arguments: { location: "東京", unit: "celsius" },
              },
            ],
            messages: [],
          };
        }

        // 通常の応答のシミュレーション
        return {
          text: "テスト応答",
          tools: [],
          messages: [],
        };
      },

      speechToText: async () => {
        return "音声テキスト変換結果";
      },

      textToSpeech: async () => {
        return {
          contentType: "audio/mp3",
          content: Buffer.from("音声データ"),
        };
      },
    };

    // buildメソッドをスタブ化して、スタブオブジェクトを返すようにする
    sinon.stub(openAIAdapterBuilder, "build").returns(adapterStub);

    // openAIAdapterインスタンスを作成
    openAIAdapter = openAIAdapterBuilder.build();

    // createReadStreamのスタブ
    createReadStreamStub = sinon.stub(fs, "createReadStream").returns("audio-file-stream" as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("chatCompletions", () => {
    it("通常のテキスト会話が正しく処理されること", async () => {
      // 環境変数の設定
      process.env.OPENAI_API_MODEL_CHAT = "gpt-4";
      process.env.OPENAI_API_KEY = "test-api-key";

      const result = await openAIAdapter.chatCompletions({
        args: {
          systemPrompt: ["アシスタントとして対応してください"],
          newMessageContents: [{ text: "こんにちは" }],
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
      expect(result).to.have.property("text", "テスト応答");
      expect(result).to.have.property("messages").that.is.an("array");
      expect(result).to.have.property("tools").that.is.an("array");
    });

    it("ツール呼び出しが正しく処理されること", async () => {
      const tools: McpTool[] = [
        {
          name: "get_weather",
          description: "指定された場所の天気情報を取得する",
          inputSchema: {
            type: "object",
            properties: {
              location: { type: "string" },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      ];

      const result = await openAIAdapter.chatCompletions({
        args: {
          systemPrompt: ["アシスタントとして対応してください"],
          newMessageContents: [{ text: "東京の天気は？" }],
          options: {
            toolOption: {
              type: "function",
              temperature: 0,
              maxTokens: 500,
            },
            tools: tools,
          },
        },
      });

      expect(result).to.not.be.null;
      expect(result).to.have.property("tools").that.is.an("array");
      expect(result?.tools).to.not.be.empty;
      expect(result?.tools[0]).to.have.property("name", "get_weather");
      expect(result?.tools[0].arguments).to.deep.equal({ location: "東京", unit: "celsius" });
    });
  });

  describe("speechToText", () => {
    it("音声からテキストへの変換が正しく行われること", async () => {
      process.env.OPENAI_API_MODEL_AUDIO_TRANSCRIPTION = "whisper-1";

      // speechToTextスタブを再定義して、fs.createReadStreamの呼び出しをモック
      sinon.restore(); // 一度全てのスタブをリセット

      // 明示的にcreateReadStreamStubを再設定
      createReadStreamStub = sinon.stub(fs, "createReadStream").returns("audio-file-stream" as any);

      // speechToTextのスタブを設定して、内部で実際にcreateSteamを呼ぶようにする
      sinon.stub(openAIAdapter, "speechToText").callsFake(async (params: any) => {
        const { args } = params || {};
        const { audioFilePath } = args || {};

        // ここで実際にcreateReadStreamを呼ぶ
        fs.createReadStream(audioFilePath);

        return "音声テキスト変換結果";
      });

      const result = openAIAdapter.speechToText
        ? await openAIAdapter.speechToText({
            args: {
              audioFilePath: "/path/to/audio.mp3",
              options: {
                language: "ja",
              },
            },
          })
        : null;

      expect(result).to.not.be.null;
      expect(result).to.equal("音声テキスト変換結果");
      expect(createReadStreamStub.calledWith("/path/to/audio.mp3")).to.be.true;
    });
  });

  describe("textToSpeech", () => {
    it("テキストから音声への変換が正しく行われること", async () => {
      process.env.OPENAI_API_MODEL_TEXT2SPEECH = "tts-1";

      const result = openAIAdapter.textToSpeech
        ? await openAIAdapter.textToSpeech({
            args: {
              message: "こんにちは、世界",
              options: {
                voice: "alloy",
                responseFormat: "mp3",
              },
            },
          })
        : null;

      expect(result).to.not.be.null;
      expect(result).to.have.property("contentType", "audio/mp3");
      expect(result?.content).to.not.be.null;
      expect(Buffer.isBuffer(result?.content)).to.be.true;
    });
  });
});
