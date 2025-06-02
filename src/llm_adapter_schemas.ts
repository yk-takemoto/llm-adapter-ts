import { z } from "zod";

export const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.string(),
    properties: z.record(z.any()),
    required: z.array(z.string()),
  }),
});
export type McpTool = z.infer<typeof mcpToolSchema>;

export const GeneralArgumentsSchema = z.record(z.any());
type GeneralArguments = z.infer<typeof GeneralArgumentsSchema>;
export const GeneralResultSchema = z.union([z.record(z.any()), z.string(), z.number(), z.boolean(), z.array(z.any())]);
type GeneralResult = z.infer<typeof GeneralResultSchema>;
export const GeneralConfigSchema = z.record(z.any());
type GeneralConfig = z.infer<typeof GeneralConfigSchema>;

type LlmAdapterInputParams<ArgumentsType = GeneralArguments, ConfigType = GeneralConfig> = {
  args?: ArgumentsType;
  argsSchema?: z.ZodType<ArgumentsType>;
  config?: ConfigType;
  configSchema?: z.ZodType<ConfigType>;
};

// type LlmAdapterResult<ResultType = GeneralResult> = ResultType | undefined;
type LlmAdapterResult<ResultType = GeneralResult> = ResultType;

export type LlmAdapterFunction<ArgumentsType = GeneralArguments, ResultType = GeneralResult, ConfigType = GeneralConfig> = (
  params?: LlmAdapterInputParams<ArgumentsType, ConfigType>,
) => LlmAdapterResult<ResultType>;

export type LlmAdapterAsyncFunction<ArgumentsType = GeneralArguments, ResultType = GeneralResult, ConfigType = GeneralConfig> = (
  params?: LlmAdapterInputParams<ArgumentsType, ConfigType>,
) => Promise<LlmAdapterResult<ResultType>>;

export const chatCompletionsContentSchema = z.object({
  text: z.string().optional(),
  image: z
    .object({
      url: z.string(),
      detail: z.any().optional(),
    })
    .optional(),
  audio: z
    .object({
      data: z.string(),
      format: z.any().optional(),
    })
    .optional(),
});
export type ChatCompletionsContent = z.infer<typeof chatCompletionsContentSchema>;

export const chatCompletionsOptionsSchema = z
  .object({
    tools: z.array(z.any()).optional(),
    toolOption: z.object({
      choice: z.any().optional(),
      maxTokens: z.number().optional(),
      temperature: z.number().optional(),
      type: z.enum(["function", "function_strict", "response_format"]).optional(),
    }),
  })
  .catchall(z.any());
export type ChatCompletionsOptions = z.infer<typeof chatCompletionsOptionsSchema>;

export const chatCompletionsArgumentsSchema = z.object({
  systemPrompt: z.array(z.string()),
  newMessageContents: z.array(chatCompletionsContentSchema),
  options: chatCompletionsOptionsSchema,
  inProgress: z
    .object({
      messages: z.array(z.any()),
      toolResults: z
        .array(
          z.object({
            id: z.string(),
            content: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type ChatCompletionsArguments = z.infer<typeof chatCompletionsArgumentsSchema>;

export const chatCompletionsResultSchema = z.object({
  text: z.string().nullable(),
  tools: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.record(z.any()),
    }),
  ),
  messages: z.array(z.any()),
});
export type ChatCompletionsResult = z.infer<typeof chatCompletionsResultSchema>;

export const speechToTextOptionsSchema = z
  .object({
    language: z.string().optional(),
  })
  .catchall(z.any());
export type SpeechToTextOptions = z.infer<typeof speechToTextOptionsSchema>;

export const speechToTextArgumentsSchema = z.object({
  audioFilePath: z.string(),
  options: speechToTextOptionsSchema.optional(),
});
export type SpeechToTextArguments = z.infer<typeof speechToTextArgumentsSchema>;

export const speechToTextResultSchema = z.string();
export type SpeechToTextResult = z.infer<typeof speechToTextResultSchema>;

export const textToSpeechOptionsSchema = z
  .object({
    voice: z.any(),
    responseFormat: z.any().optional(),
  })
  .catchall(z.any());
export type TextToSpeechOptions = z.infer<typeof textToSpeechOptionsSchema>;

export const textToSpeechArgumentsSchema = z.object({
  message: z.string(),
  options: textToSpeechOptionsSchema.optional(),
});
export type TextToSpeechArguments = z.infer<typeof textToSpeechArgumentsSchema>;

export const textToSpeechResultSchema = z.object({
  contentType: z.string(),
  content: z.instanceof(Buffer),
});
export type TextToSpeechResult = z.infer<typeof textToSpeechResultSchema>;

export type ChatCompletionsAdapter = {
  chatCompletions: LlmAdapterAsyncFunction<ChatCompletionsArguments, ChatCompletionsResult>;
};

export type SpeechToTextAdapter = {
  speechToText: LlmAdapterAsyncFunction<SpeechToTextArguments, SpeechToTextResult>;
};

export type TextToSpeechAdapter = {
  textToSpeech: LlmAdapterAsyncFunction<TextToSpeechArguments, TextToSpeechResult>;
};

export type LlmAdapter = ChatCompletionsAdapter & Partial<SpeechToTextAdapter & TextToSpeechAdapter>;

export const llmIdSchema = z.enum(["OpenAI", "AzureOpenAI", "Anthropic", "Google", "Groq"]);
export type LlmId = z.infer<typeof llmIdSchema>;

export type LlmAdapterBuilder = {
  build: LlmAdapterFunction<LlmId, LlmAdapter>;
};

export type LlmClientBuilder<LlmClientType> = {
  build: LlmAdapterFunction<undefined, LlmClientType>;
};
