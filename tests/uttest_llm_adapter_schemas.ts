import { expect } from "chai";
import {
  mcpToolSchema,
  chatCompletionsContentSchema,
  chatCompletionsOptionsSchema,
  chatCompletionsArgsSchema,
  chatCompletionsResultSchema,
  speechToTextArgsSchema,
  textToSpeechArgsSchema,
  textToSpeechResultSchema,
  embeddingOptionsSchema,
  embeddingArgsSchema,
  embeddingResultSchema,
  llmIdSchema,
} from "../src/llm_adapter_schemas";

describe("LLM Adapter Schemas Tests", () => {
  describe("McpTool Schema", () => {
    it("有効なMcpToolオブジェクトを正しく検証できること", () => {
      const validTool = {
        name: "get_weather",
        description: "天気情報を取得する",
        inputSchema: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
      };

      const result = mcpToolSchema.safeParse(validTool);
      expect(result.success).to.be.true;
    });

    it("必須フィールドが欠けている場合にエラーとなること", () => {
      const invalidTool = {
        name: "get_weather",
        description: "天気情報を取得する",
      };

      const result = mcpToolSchema.safeParse(invalidTool);
      expect(result.success).to.be.false;
    });
  });

  describe("Chat Completions Schemas", () => {
    it("有効なchatCompletionsContentを正しく検証できること", () => {
      const validContent = {
        text: "こんにちは",
        image: {
          url: "https://example.com/image.jpg",
        },
      };

      const result = chatCompletionsContentSchema.safeParse(validContent);
      expect(result.success).to.be.true;
    });

    it("有効なchatCompletionsOptionsを正しく検証できること", () => {
      const validOptions = {
        tools: [],
        toolOption: {
          type: "function",
          temperature: 0.7,
          maxTokens: 500,
        },
      };

      const result = chatCompletionsOptionsSchema.safeParse(validOptions);
      expect(result.success).to.be.true;
    });

    it("有効なchatCompletionsArgsを正しく検証できること", () => {
      const validArgs = {
        systemPrompt: ["アシスタントとして応答してください"],
        newMessageContents: [{ text: "こんにちは" }],
        options: {
          tools: [],
          toolOption: {
            temperature: 0.7,
            maxTokens: 500,
          },
        },
      };

      const result = chatCompletionsArgsSchema.safeParse(validArgs);
      expect(result.success).to.be.true;
    });

    it("有効なchatCompletionsResultを正しく検証できること", () => {
      const validResult = {
        text: "こんにちは",
        tools: [
          {
            id: "123",
            name: "get_weather",
            arguments: { location: "東京" },
          },
        ],
        messages: [],
      };

      const result = chatCompletionsResultSchema.safeParse(validResult);
      expect(result.success).to.be.true;
    });
  });

  describe("Speech Related Schemas", () => {
    it("有効なspeechToTextArgsを正しく検証できること", () => {
      const validArgs = {
        audioFilePath: "/path/to/audio.mp3",
        options: {
          language: "ja",
        },
      };

      const result = speechToTextArgsSchema.safeParse(validArgs);
      expect(result.success).to.be.true;
    });

    it("有効なtextToSpeechArgsを正しく検証できること", () => {
      const validArgs = {
        message: "こんにちは",
        options: {
          voice: "alloy",
          responseFormat: "mp3",
        },
      };

      const result = textToSpeechArgsSchema.safeParse(validArgs);
      expect(result.success).to.be.true;
    });

    it("有効なtextToSpeechResultを正しく検証できること", () => {
      const validResult = {
        contentType: "audio/mp3",
        content: Buffer.from("test audio data"),
      };

      const result = textToSpeechResultSchema.safeParse(validResult);
      expect(result.success).to.be.true;
    });
  });

  describe("LLM ID Schema", () => {
    it("有効なLLM IDを正しく検証できること", () => {
      const validIds = ["OpenAI", "AzureOpenAI", "Anthropic", "Google", "Groq"];
      validIds.forEach((id) => {
        const result = llmIdSchema.safeParse(id);
        expect(result.success).to.be.true;
      });
    });

    it("無効なLLM IDの場合にエラーとなること", () => {
      const invalidId = "InvalidLLM";
      const result = llmIdSchema.safeParse(invalidId);
      expect(result.success).to.be.false;
    });
  });

  describe("Embedding Schemas", () => {
    it("有効なembeddingOptionsを正しく検証できること", () => {
      const validOptions = {
        dimensions: 1536,
      };

      const result = embeddingOptionsSchema.safeParse(validOptions);
      expect(result.success).to.be.true;
    });

    it("空のembeddingOptionsを正しく検証できること", () => {
      const emptyOptions = {};

      const result = embeddingOptionsSchema.safeParse(emptyOptions);
      expect(result.success).to.be.true;
    });

    it("有効なembeddingArgsを正しく検証できること", () => {
      const validArgs = {
        text: "これはサンプルテキストです",
        options: {
          dimensions: 1536,
        },
      };

      const result = embeddingArgsSchema.safeParse(validArgs);
      expect(result.success).to.be.true;
    });

    it("optionsなしのembeddingArgsを正しく検証できること", () => {
      const validArgs = {
        text: "これはサンプルテキストです",
      };

      const result = embeddingArgsSchema.safeParse(validArgs);
      expect(result.success).to.be.true;
    });

    it("textが欠けているembeddingArgsでエラーとなること", () => {
      const invalidArgs = {
        options: {
          dimensions: 1536,
        },
      };

      const result = embeddingArgsSchema.safeParse(invalidArgs);
      expect(result.success).to.be.false;
    });

    it("有効なembeddingResultを正しく検証できること", () => {
      const validResult = {
        embedding: [0.1, 0.2, 0.3, -0.4, 0.5],
      };

      const result = embeddingResultSchema.safeParse(validResult);
      expect(result.success).to.be.true;
    });

    it("embeddingが配列でないembeddingResultでエラーとなること", () => {
      const invalidResult = {
        embedding: "not an array",
      };

      const result = embeddingResultSchema.safeParse(invalidResult);
      expect(result.success).to.be.false;
    });

    it("embeddingが数値配列でないembeddingResultでエラーとなること", () => {
      const invalidResult = {
        embedding: ["0.1", "0.2", "0.3"],
      };

      const result = embeddingResultSchema.safeParse(invalidResult);
      expect(result.success).to.be.false;
    });
  });
});
