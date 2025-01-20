import { promises as fs } from "fs";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  ModelParams,
  Content,
  FunctionDeclaration,
  Tool,
  FunctionCallingMode,
  FunctionCallPart,
  GenerationConfig,
  ResponseSchema,
  Part,
} from "@google/generative-ai";
import { LlmAdapter } from "@/llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse, McpTool } from "@/llm_adapter_schemas";

export class GeminiAdapter implements LlmAdapter {
  protected geminiClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
      apiModelChat: process.env.GEMINI_API_MODEL_CHAT!,
    },
  ) {
    this.initCheck(llmConfig);
    this.geminiClient = new GoogleGenerativeAI(llmConfig.apiKey);
  }

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  // A function to delete parameters such as additionalProperties because the GeminiAPI tool schema does not support jsonSchema7.
  private cleanJsonSchema(schema: Record<string, any>): Record<string, any> {
    if (typeof schema !== "object" || schema === null) {
      return schema;
    }
    if (schema.type === "object") {
      const cleanedSchema: Record<string, any> = {};
      Object.keys(schema).forEach((key) => {
        if (key !== "additionalProperties" && key !== "$schema") {
          if (key === "properties") {
            cleanedSchema.properties = Object.keys(schema.properties).reduce(
              (acc, propKey) => ({
                ...acc,
                [propKey]: this.cleanJsonSchema(schema.properties[propKey]),
              }),
              {},
            );
          } else {
            cleanedSchema[key] = schema[key];
          }
        }
      });
      return cleanedSchema;
    }
    if (schema.type === "array" && schema.items) {
      const { items, ...rest } = schema;
      return {
        ...rest,
        items: this.cleanJsonSchema(items),
      };
    }
    return schema;
  }

  private convertTools(tools: McpTool[]): Tool[] {
    const functions = tools.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: this.cleanJsonSchema(tool.inputSchema),
      } as FunctionDeclaration;
    });
    // debug
    console.log("[convertTools] functions: ", JSON.stringify(functions, null, 2));
    return [{ functionDeclarations: functions }];
  }

  private convertResponseFormatJSONSchema(tool: McpTool): GenerationConfig {
    return {
      responseMimeType: "application/json",
      responseSchema: this.cleanJsonSchema(tool.inputSchema) as ResponseSchema,
    };
  }

  private async convertImageUrlToBase64(imageUrl: string): Promise<{
    mimeType: string;
    base64Content: string;
  }> {
    try {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const base64Content = buffer.toString("base64");
      return { mimeType, base64Content };
    } catch (error) {
      throw new Error(`Failed to fetch or convert image: ${error}`);
    }
  }

  private convertMessagesForHistory(messages: Content[]): Content[] {
    return messages.map((message) => ({
      role: message.role,
      parts: message.parts.map((part) => (part.inlineData?.data ? ({ ...part, inlineData: { ...part.inlineData, data: "ommitted" } } as Part) : part)),
    }));
  }

  async chatCompletions(
    systemPrompt: string[],
    firstMessageContents: LlmChatCompletionsContent[],
    options: LlmChatCompletionsOptions,
    inProgress?: {
      messages: Content[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    },
  ): Promise<LlmChatCompletionsResponse> {
    const covertedSystemPrompt: Content = {
      role: "model",
      parts: [],
    };
    systemPrompt.forEach((msg) => {
      covertedSystemPrompt.parts.push({
        text: msg,
      });
    });
    let updatedMessages: Content[] = [];
    if (inProgress) {
      const resParts =
        inProgress.toolResults?.map((toolResult) => {
          return { text: toolResult.content };
        }) || [];
      updatedMessages = inProgress.messages.concat({ role: "user", parts: resParts });
    } else {
      const resParts = await Promise.all(
        firstMessageContents.map(async (content) => {
          if (content.image) {
            const { mimeType, base64Content } = await this.convertImageUrlToBase64(content.image.url);
            return {
              inlineData: {
                mimeType: mimeType,
                data: base64Content,
              },
            };
          } else {
            return { text: content.text || "" };
          }
        }),
      );
      updatedMessages.push({ role: "user", parts: resParts });
    }

    let toolsOption = {};
    let resFormatOption = {};
    if (options.tools && options.tools.length > 0) {
      toolsOption =
        options.purposeOfTools === "function"
          ? {
              tools: this.convertTools(options.tools),
              toolConfig: {
                functionCallingConfig: {
                  mode: (String(options.toolChoice).toUpperCase() as FunctionCallingMode) || FunctionCallingMode.AUTO,
                },
              },
            }
          : {};
      resFormatOption = options.purposeOfTools === "response_format" ? this.convertResponseFormatJSONSchema(options.tools[0]) : {};
    }

    const modelParams: ModelParams = {
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
      generationConfig: {
        maxOutputTokens: (options.maxTokens as number) || 1028,
        temperature: (options.temperature as number) ?? 0.7,
        ...resFormatOption,
      },
      model: this.llmConfig.apiModelChat,
      systemInstruction: covertedSystemPrompt,
      ...toolsOption,
    };
    let response: LlmChatCompletionsResponse = {
      text: "",
      tools: [],
      messages: [],
    };
    try {
      // For history
      const historyMessages = this.convertMessagesForHistory(updatedMessages);

      // debug
      console.log("[chatCompletions] start -- historyMessages: ", JSON.stringify(historyMessages));

      const chatResult = await this.geminiClient.getGenerativeModel(modelParams).generateContent({
        contents: updatedMessages,
      });
      const chatResponse = chatResult.response;
      const text = chatResponse.text();
      const funcCalls = chatResponse.functionCalls();
      const finishReason = chatResponse.candidates && chatResponse.candidates[0].finishReason;
      // debug
      console.log(`[chatCompletions] end -- response.text: ${text} response.functionCalls: ${JSON.stringify(funcCalls)} finishReason: ${finishReason}`);

      let resTools: { id: string; name: string; arguments: Record<string, any> }[] = [];
      if (chatResponse) {
        const parts: FunctionCallPart[] = [];
        resTools = funcCalls
          ? funcCalls?.map((funcCall) => {
              parts.push({ functionCall: funcCall });
              return {
                id: "",
                name: funcCall.name,
                arguments: JSON.parse(JSON.stringify(funcCall.args)) as Record<string, any>,
              };
            }) || []
          : [];
        historyMessages.push({ role: "model", parts: parts });
      }

      response = {
        text: text,
        tools: resTools,
        messages: historyMessages,
      };
    } catch (error) {
      // debug
      console.log("[chatCompletions] Error: ", error);
      throw error;
    }

    // debug
    console.log("[chatCompletions] response: ", response);
    return response;
  }

  async speechToText(__: string, ___?: Record<string, any>): Promise<string> {
    //================ Not supported
    try {
      return "unsupported";
    } catch (error) {
      // debug
      console.log("[speechToText] Error: ", error);
      throw error;
    }
  }

  async textToSpeech(_: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse> {
    //================ Not supported
    try {
      const sorryFormat = options?.responseFormat === "wav" || options?.responseFormat === "aac" ? options.responseFormat : "mp3";
      const sorry = await fs.readFile(`audio/sorry.ja.${sorryFormat}`);
      const contentType = sorryFormat === "mp3" ? "audio/mpeg" : `audio/${sorryFormat}`;
      return {
        contentType: contentType,
        content: sorry,
      };
    } catch (error) {
      // debug
      console.log("[textToSpeech] Error: ", error);
      throw error;
    }
  }
}
