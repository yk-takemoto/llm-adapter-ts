import { promises as fs } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { LlmAdapter } from "@/llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse, McpTool } from "@/llm_adapter_schemas";

export class AnthropicAdapter implements LlmAdapter {
  protected anthropicClient;

  constructor(
    protected llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
      apiModelChat: process.env.ANTHROPIC_API_MODEL_CHAT!,
    },
  ) {
    this.initCheck(llmConfig);
    this.anthropicClient = new Anthropic({ apiKey: llmConfig.apiKey });
  }

  private initCheck(llmConfig: Record<string, string>) {
    for (const key of Object.keys(this.llmConfig)) {
      if (!llmConfig[key]) {
        throw new Error(`llmConfig.${key} is required but not set.`);
      }
    }
  }

  private convertTools(tools: McpTool[]): Anthropic.Tool[] {
    return tools.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
      };
    });
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

  private convertMessagesForHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
    return messages.map((message) => ({
      role: message.role,
      content: Array.isArray(message.content)
        ? message.content.map((item) =>
            item.type === "image" ? ({ ...item, source: { ...item.source, data: "ommitted" } } as Anthropic.ImageBlockParam) : item,
          )
        : message.content,
    }));
  }

  async chatCompletions(
    systemPrompt: string[],
    newMessageContents: LlmChatCompletionsContent[],
    options: LlmChatCompletionsOptions,
    inProgress?: {
      messages: Anthropic.MessageParam[];
      toolResults?: {
        id: string;
        content: string;
      }[];
    },
  ): Promise<LlmChatCompletionsResponse> {
    const covertedSystemPrompt: Anthropic.TextBlockParam[] = [];
    systemPrompt.forEach((msg) => {
      covertedSystemPrompt.push({
        type: "text",
        text: msg,
      });
    });
    let updatedMessages: Anthropic.MessageParam[] = [];
    if (inProgress) {
      const resMessages =
        inProgress.toolResults?.map((toolResult) => {
          return {
            tool_use_id: toolResult.id,
            type: "tool_result" as const,
            content: toolResult.content,
          } as Anthropic.ToolResultBlockParam;
        }) || [];
      updatedMessages = inProgress.messages.concat({ role: "user", content: resMessages });
    }
    if (newMessageContents.length > 0) {
      const list = await Promise.all(
        newMessageContents.map(async (content) => {
          if (content.image) {
            const { mimeType, base64Content } = await this.convertImageUrlToBase64(content.image.url);
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Content,
              },
            } as Anthropic.ImageBlockParam;
          } else {
            return {
              type: "text",
              text: content.text || "",
            } as Anthropic.TextBlockParam;
          }
        }),
      );
      updatedMessages.push({
        role: "user",
        content: list,
      });
    }

    const toolsOption =
      options.tools && options.tools.length > 0
        ? {
            tools: this.convertTools(options.tools),
            tool_choice: { type: options.toolChoice || "auto" } as Anthropic.ToolChoice,
          }
        : {};

    const chatOtions: Anthropic.MessageCreateParams = {
      model: this.llmConfig.apiModelChat,
      messages: updatedMessages,
      system: covertedSystemPrompt,
      max_tokens: (options.maxTokens as number) || 1028,
      temperature: (options.temperature as number) ?? 0.7,
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
      console.log(
        "[chatCompletions] start -- covertedSystemPrompt: ",
        JSON.stringify(covertedSystemPrompt),
        " -- historyMessages: ",
        JSON.stringify(historyMessages),
      );
      const chatResponse = await this.anthropicClient.messages.create(chatOtions);
      const contents = chatResponse.content;
      const stopReason = chatResponse.stop_reason;
      // debug
      console.log(`[chatCompletions] end -- contents: ${JSON.stringify(contents)} stopReason: ${stopReason}`);

      let resTools: { id: string; name: string; arguments: Record<string, any> }[] = [];
      if (chatResponse) {
        historyMessages.push({
          role: chatResponse.role,
          content: contents,
        });
        resTools =
          stopReason === "tool_use"
            ? contents
                ?.filter((contentBlock) => contentBlock.type === "tool_use")
                .map((contentBlock) => {
                  return {
                    id: contentBlock.id,
                    name: contentBlock.name,
                    arguments: JSON.parse(JSON.stringify(contentBlock.input)) as Record<string, any>,
                  };
                }) || []
            : [];
      }

      response = {
        text:
          resTools.length > 0 && options.purposeOfTools === "response_format"
            ? JSON.stringify(resTools[0].arguments)
            : (contents[0] as Anthropic.TextBlock).text || null,
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
