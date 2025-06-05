import { Groq } from "groq-sdk";
import { z } from "zod";
import { McpTool, LlmAdapterBuilder, LlmClientBuilder, chatCompletionsArgsSchema } from "@/llm_adapter_schemas";

const convertTools = (tools: McpTool[]): Groq.Chat.ChatCompletionTool[] => {
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
};

const groqClientBuilderArgsSchema = z.object({
  apiKey: z.string().min(1, "GROQ_API_KEY is required"),
}).passthrough();
export type GroqClientBuilderArgs = z.infer<typeof groqClientBuilderArgsSchema>;

const groqClientBuilder: LlmClientBuilder<GroqClientBuilderArgs, Groq> = {
  build: ({
    args = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GROQ_API_KEY || process.env.GROQ_API_KEY,
    },
    argsSchema = groqClientBuilderArgsSchema,
  } = {}) => {
    const parsedArgs = argsSchema.parse(args || {});
    return new Groq(parsedArgs);
  },
};

export const groqAdapterBuilder: LlmAdapterBuilder<GroqClientBuilderArgs> = {
  build: ({ buildClientInputParams } = {}) => ({
    chatCompletions: async ({
      args,
      argsSchema = chatCompletionsArgsSchema,
      config = {
        apiModelChat: process.env.GROQ_API_MODEL_CHAT,
      },
      configSchema = z.object({
        apiModelChat: z.string().min(1, "GROQ_API_MODEL_CHAT is required"),
      }),
    } = {}) => {
      const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
      const { apiModelChat } = configSchema.parse(config || {});

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
        const hasImage = newMessageContents.some((content) => content.image);
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
      }
      if (newMessageContents.length > 0) {
        updatedMessages.push({
          role: "user",
          content: newMessageContents.map((content) => {
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
          options.toolOption.type === "function" || options.toolOption.type === "function_strict"
            ? {
                tools: convertTools(options.tools),
                tool_choice: options.toolOption.choice || ("auto" as Groq.Chat.ChatCompletionToolChoiceOption),
              }
            : {};
        resFormatOption =
          options.toolOption.type === "response_format"
            ? {
                response_format: {
                  type: "json_object",
                } as Groq.Chat.CompletionCreateParams.ResponseFormat,
              }
            : {};
      }

      const chatOtions = {
        model: apiModelChat,
        messages: updatedMessages,
        max_tokens: options.toolOption.maxTokens || 1028,
        temperature: options.toolOption.temperature ?? 0.7,
        ...toolsOption,
        ...resFormatOption,
      };
      let response;
      try {
        // debug
        console.log("[chatCompletions] start -- updatedMessages: ", JSON.stringify(updatedMessages));
        const groqClient = groqClientBuilder.build(buildClientInputParams || {});
        const chatResponse = await groqClient.chat.completions.create(chatOtions);
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
    },
  }),
};
