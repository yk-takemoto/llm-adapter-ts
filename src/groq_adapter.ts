import { promises as fs } from "fs";
import { Groq } from "groq-sdk";
import { LlmAdapter } from "@/llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse, McpTool } from "@/llm_adapter_schemas";

export class GroqAdapter implements LlmAdapter {
  protected groqClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GROQ_API_KEY || process.env.GROQ_API_KEY || "",
      apiModelChat: process.env.GROQ_API_MODEL_CHAT!,
    },
  ) {
    this.initCheck(llmConfig);
    this.groqClient = new Groq({ apiKey: llmConfig.apiKey });
  }

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  private convertTools(tools: McpTool[]): Groq.Chat.ChatCompletionTool[] {
    return tools.map((tool) => {
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      };
    });
  }

  async chatCompletions(
    systemPrompt: string[],
    firstMessageContents: LlmChatCompletionsContent[],
    options: LlmChatCompletionsOptions,
    inProgress?: {
      messages: Groq.Chat.ChatCompletionMessageParam[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    },
  ): Promise<LlmChatCompletionsResponse> {
    let updatedMessages: Groq.Chat.ChatCompletionMessageParam[] = [];
    if (inProgress) {
      const resMessages =
        inProgress.toolResults?.map((toolResult) => {
          return {
            tool_call_id: toolResult.id,
            role: "tool",
            content: toolResult.content,
          } as Groq.Chat.ChatCompletionMessageParam;
        }) || [];
      updatedMessages = inProgress.messages.concat(resMessages);
    } else {
      // Solutions to the following issues:
      // "prompting with images is incompatible with system messages"
      const hasImage = firstMessageContents.some((content) => content.image);
      if (hasImage) {
        updatedMessages.push({
          role: "user",
          content: systemPrompt.map((msg) => {
            return {
              type: "text",
              text: msg,
            };
          }),
        });
      } else {
        systemPrompt.forEach((msg) => {
          updatedMessages.push({
            role: "system",
            content: msg,
          });
        });
      }

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
              tools: this.convertTools(options.tools),
              tool_choice: options.toolChoice || ("auto" as Groq.Chat.ChatCompletionToolChoiceOption),
            }
          : {};
      resFormatOption =
        options.purposeOfTools === "response_format"
          ? {
              response_format: {
                type: "json_object",
              } as Groq.Chat.CompletionCreateParams.ResponseFormat,
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
      const chatResponse = await this.groqClient.chat.completions.create(chatOtions);
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
