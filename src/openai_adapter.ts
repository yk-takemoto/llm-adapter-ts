import OpenAI from "openai";
import { createReadStream } from "fs";
import { LlmAdapter } from "@/llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse, McpTool } from "@/llm_adapter_schemas";

export class OpenAIAdapter<T extends OpenAI> implements LlmAdapter {
  protected openaiClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").OPENAI_API_KEY || process.env.OPENAI_API_KEY || "",
      apiModelChat: process.env.OPENAI_API_MODEL_CHAT!,
      apiModelAudioTranscription: process.env.OPENAI_API_MODEL_AUDIO_TRANSCRIPTION!,
      apiModelText2Speech: process.env.OPENAI_API_MODEL_TEXT2SPEECH!,
    },
    apiClient?: T,
  ) {
    this.initCheck(llmConfig);
    this.openaiClient = apiClient || new OpenAI({ apiKey: llmConfig.apiKey });
  }

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  private addAdditionalPropertiesElementToObjectType(schema: any, bool: boolean = false) {
    if (typeof schema !== "object" || schema === null) {
      return schema;
    }
    if (schema.type === "object") {
      schema.additionalProperties = bool;
      if (schema.properties) {
        for (const key in schema.properties) {
          schema.properties[key] = this.addAdditionalPropertiesElementToObjectType(schema.properties[key], bool);
        }
      }
    }
    if (schema.type === "array" && schema.items) {
      schema.items = this.addAdditionalPropertiesElementToObjectType(schema.items, bool);
    }
    return schema;
  }

  private convertTools(tools: McpTool[], isStrict?: boolean): OpenAI.ChatCompletionTool[] {
    const strict = isStrict
      ? {
          strict: isStrict,
        }
      : {};
    return tools.map((tool) => {
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          ...strict,
          parameters: isStrict ? this.addAdditionalPropertiesElementToObjectType(tool.inputSchema, !isStrict) : tool.inputSchema,
        },
      };
    });
  }

  private convertResponseFormatJSONSchema(tool: McpTool): OpenAI.ResponseFormatJSONSchema {
    return {
      type: "json_schema",
      json_schema: {
        name: tool.name,
        description: tool.description,
        strict: true,
        schema: this.addAdditionalPropertiesElementToObjectType(tool.inputSchema, false),
      },
    };
  }

  async chatCompletions(
    systemPrompt: string[],
    firstMessageContents: LlmChatCompletionsContent[],
    options: LlmChatCompletionsOptions,
    inProgress?: {
      messages: OpenAI.ChatCompletionMessageParam[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    },
  ): Promise<LlmChatCompletionsResponse> {
    let updatedMessages: OpenAI.ChatCompletionMessageParam[] = [];
    if (inProgress) {
      const resMessages =
        inProgress.toolResults?.map((toolResult) => {
          return {
            tool_call_id: toolResult.id,
            role: "tool",
            content: toolResult.content,
          } as OpenAI.ChatCompletionMessageParam;
        }) || [];
      updatedMessages = inProgress.messages.concat(resMessages);
    } else {
      systemPrompt.forEach((msg) => {
        updatedMessages.push({
          role: "system",
          content: msg,
        });
      });
      updatedMessages.push({
        role: "user",
        content: firstMessageContents.map((content) => {
          return content.image
            ? {
                type: "image_url",
                image_url: {
                  url: content.image.url,
                  detail: content.image.detail || "auto",
                },
              }
            : content.audio
              ? {
                  type: "input_audio",
                  input_audio: {
                    data: content.audio.data,
                    format: content.audio.format || "mp3",
                  },
                }
              : {
                  type: "text",
                  text: content.text || "",
                };
        }),
      });
    }

    let toolsOption = {};
    let resFormatOption = {};
    if (options.tools && options.tools.length > 0) {
      toolsOption =
        options.purposeOfTools === "function"
          ? {
              tools: this.convertTools(options.tools, true),
              tool_choice: options.toolChoice || ("auto" as OpenAI.ChatCompletionToolChoiceOption),
            }
          : {};
      resFormatOption =
        options.purposeOfTools === "response_format"
          ? {
              response_format: this.convertResponseFormatJSONSchema(options.tools[0]),
            }
          : {};
    }

    const chatOtions = {
      model: this.llmConfig.apiModelChat,
      messages: updatedMessages,
      max_tokens: (options.maxTokens as number) || 1028,
      temperature: (options.temperature as number) ?? 0.7,
      ...toolsOption,
      ...resFormatOption,
    };
    let response: LlmChatCompletionsResponse = {
      text: "",
      tools: [],
      messages: [],
    };
    try {
      // debug
      console.log("[chatCompletions] start -- updatedMessages: ", JSON.stringify(updatedMessages));
      const chatResponse = await this.openaiClient.chat.completions.create(chatOtions);
      const choice = chatResponse.choices[0];
      const finishReason = choice.finish_reason;
      // debug
      console.log(`[chatCompletions] end -- choices[0].message: ${JSON.stringify(choice.message)} finishReason: ${finishReason}`);

      let resTools: { id: string; name: string; arguments: Record<string, any> }[] = [];
      if (choice.message) {
        updatedMessages.push(choice.message);
        resTools =
          finishReason === "tool_calls"
            ? choice.message.tool_calls?.map((tool_call) => {
                return {
                  id: tool_call.id,
                  name: tool_call.function.name,
                  arguments: JSON.parse(tool_call.function.arguments) as Record<string, any>,
                };
              }) || []
            : [];
      }

      response = {
        text: choice.message?.content,
        tools: resTools,
        messages: updatedMessages,
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

  async speechToText(audioFilePath: string, options?: Record<string, any>): Promise<string> {
    const speechOtions = {
      file: createReadStream(audioFilePath),
      model: this.llmConfig.apiModelAudioTranscription,
      language: options?.language || "ja",
    };
    try {
      const response = await this.openaiClient.audio.transcriptions.create(speechOtions);
      return response.text;
    } catch (error) {
      // debug
      console.log("[speechToText] Error: ", error);
      throw error;
    }
  }

  async textToSpeech(message: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse> {
    const speechOtions = {
      model: this.llmConfig.apiModelText2Speech || "tts-1",
      input: message,
      voice: options?.voice || "alloy",
      response_format: options?.responseFormat || "mp3",
    };
    try {
      const response = await this.openaiClient.audio.speech.create(speechOtions);
      const contentType = response.headers.get("content-type");
      const arrayBuffer = await response.arrayBuffer();
      return {
        contentType: contentType!,
        content: Buffer.from(arrayBuffer),
      };
    } catch (error) {
      // debug
      console.log("[textToSpeech] Error: ", error);
      throw error;
    }
  }
}
