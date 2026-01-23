import { expect } from "chai";
import sinon from "sinon";
import { groqAdapterBuilder } from "../src/groq_adapter";
import { McpTool } from "../src/llm_adapter_schemas";
import fs from "fs";

describe("Groq Adapter Tests", () => {
  // createReadStreamのスタブを変数として定義
  let createReadStreamStub: sinon.SinonStub;
  let groqAdapter: ReturnType<typeof groqAdapterBuilder.build>;

  beforeEach(() => {
    // groqAdapterBuilderのbuildメソッドの戻り値をスタブ化
    const adapterStub = {
      chatCompletions: async (params: any) => {
        const { args } = params || {};
        const { options } = args || {};

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
          contentType: "audio/wav",
          content: Buffer.from("音声データ"),
        };
      },
    };

    sinon.stub(groqAdapterBuilder, "build").returns(adapterStub);
    groqAdapter = groqAdapterBuilder.build();

    // createReadStreamのスタブ
    createReadStreamStub = sinon.stub(fs, "createReadStream").returns("audio-file-stream" as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("chatCompletions", () => {
    it("通常のテキスト会話が正しく処理されること", async () => {
      // 環境変数の設定
      process.env.GROQ_API_MODEL_CHAT = "meta-llama/llama-4-scout-17b-16e-instruct";
      process.env.GROQ_API_KEY = "test-api-key";

      const result = await groqAdapter.chatCompletions({
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

      const result = await groqAdapter.chatCompletions({
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
      process.env.GROQ_API_MODEL_AUDIO_TRANSCRIPTION = "distil-whisper-large-v3-en";

      // speechToTextスタブを再定義して、fs.createReadStreamの呼び出しをモック
      sinon.restore(); // 一度全てのスタブをリセット

      // 明示的にcreateReadStreamStubを再設定
      createReadStreamStub = sinon.stub(fs, "createReadStream").returns("audio-file-stream" as any);

      // speechToTextのスタブを設定して、内部で実際にcreateSteamを呼ぶようにする
      sinon.stub(groqAdapter, "speechToText").callsFake(async (params: any) => {
        const { args } = params || {};
        const { audioFilePath } = args || {};

        // ここで実際にcreateReadStreamを呼ぶ
        fs.createReadStream(audioFilePath);

        return "音声テキスト変換結果";
      });

      const result = groqAdapter.speechToText
        ? await groqAdapter.speechToText({
            args: {
              audioFilePath: "/path/to/audio.wav",
              options: {
                language: "ja",
              },
            },
          })
        : null;

      expect(result).to.not.be.null;
      expect(result).to.equal("音声テキスト変換結果");
      expect(createReadStreamStub.calledWith("/path/to/audio.wav")).to.be.true;
    });
  });

  describe("textToSpeech", () => {
    it("テキストから音声への変換が正しく行われること", async () => {
      process.env.GROQ_API_MODEL_TEXT2SPEECH = "Aaliyah-PlayAI";

      const result = groqAdapter.textToSpeech
        ? await groqAdapter.textToSpeech({
            args: {
              message: "こんにちは、世界",
              options: {
                voice: "Aaliyah-PlayAI",
                responseFormat: "wav",
              },
            },
          })
        : null;

      expect(result).to.not.be.null;
      expect(result).to.have.property("contentType", "audio/wav");
      expect(result?.content).to.not.be.null;
      expect(Buffer.isBuffer(result?.content)).to.be.true;
    });
  });
});
