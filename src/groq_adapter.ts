import { Groq } from "groq-sdk";
import { createReadStream } from "fs";
import { z } from "zod";
import { McpTool, LlmAdapterBuilder, LlmClientBuilder, chatCompletionsArgsSchema, speechToTextArgsSchema, textToSpeechArgsSchema } from "@/llm_adapter_schemas";

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

const groqClientBuilderArgsSchema = z
  .object({
    apiKey: z.string().min(1, "GROQ_API_KEY is required"),
  })
  .passthrough();
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
                } as Groq.Chat.CompletionCreateParams.ResponseFormatJsonObject,
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
    speechToText: async ({
      args,
      argsSchema = speechToTextArgsSchema,
      config = {
        apiModelAudioTranscription: process.env.GROQ_API_MODEL_AUDIO_TRANSCRIPTION,
      },
      configSchema = z.object({
        apiModelAudioTranscription: z.string().min(1, "GROQ_API_MODEL_AUDIO_TRANSCRIPTION is required"),
      }),
    } = {}) => {
      const { audioFilePath, options } = argsSchema.parse(args);
      const { apiModelAudioTranscription } = configSchema.parse(config);

      const speechOtions = {
        file: createReadStream(audioFilePath),
        model: apiModelAudioTranscription,
        language: options?.language || "ja",
      };
      try {
        const groqClient = groqClientBuilder.build(buildClientInputParams || {});
        const response = await groqClient.audio.transcriptions.create(speechOtions);
        return response.text;
      } catch (error) {
        // debug
        console.log("[speechToText] Error: ", error);
        throw error;
      }
    },
    textToSpeech: async ({
      args,
      argsSchema = textToSpeechArgsSchema,
      config = {
        apiModelText2Speech: process.env.GROQ_API_MODEL_TEXT2SPEECH,
      },
      configSchema = z.object({
        apiModelText2Speech: z.string().min(1, "GROQ_API_MODEL_TEXT2SPEECH is required"),
      }),
    } = {}) => {
      const { message, options } = argsSchema.parse(args);
      const { apiModelText2Speech } = configSchema.parse(config);

      const speechOtions = {
        model: apiModelText2Speech as string,
        input: message,
        voice: options?.voice || "autumn",
        response_format: options?.responseFormat || "wav",
      };
      try {
        const groqClient = groqClientBuilder.build(buildClientInputParams || {});
        const response = await groqClient.audio.speech.create(speechOtions);
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = (await response.arrayBuffer()) as ArrayBuffer;
        return {
          contentType: contentType,
          content: Buffer.from(arrayBuffer) as Buffer<ArrayBuffer>,
        };
      } catch (error) {
        // debug
        console.log("[textToSpeech] Error: ", error);
        throw error;
      }
    },
    // embedding: async ({
    //   args,
    //   argsSchema = embeddingArgsSchema,
    //   config = {
    //     apiModelEmbedding: process.env.GROQ_API_MODEL_EMBEDDING,
    //   },
    //   configSchema = z.object({
    //     apiModelEmbedding: z.string().min(1, "GROQ_API_MODEL_EMBEDDING is required"),
    //   }),
    // } = {}) => {
    //   const { text, options } = argsSchema.parse(args);
    //   const { apiModelEmbedding } = configSchema.parse(config);

    //   const embeddingOtions = {
    //     model: apiModelEmbedding as string,
    //     input: text,
    //     ...options,
    //   };
    //   try {
    //     const groqClient = groqClientBuilder.build(buildClientInputParams || {});
    //     const response = await groqClient.embeddings.create(embeddingOtions);
    //     return {
    //       // TODO if type of string, convert to array
    //       embedding: typeof response.data[0].embedding === "string" ? [] : response.data[0].embedding,
    //     };
    //   } catch (error) {
    //     // debug
    //     console.log("[embedding] Error: ", error);
    //     throw error;
    //   }
    // },
  }),
};
