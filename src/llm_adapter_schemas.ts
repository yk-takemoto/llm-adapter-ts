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

export const generalArgumentsSchema = z.record(z.any());
type GeneralArguments = z.infer<typeof generalArgumentsSchema>;
export const generalResultSchema = z.union([z.record(z.any()), z.string(), z.number(), z.boolean(), z.array(z.any())]);
type GeneralResult = z.infer<typeof generalResultSchema>;
export const generalConfigSchema = z.record(z.any());
type GeneralConfig = z.infer<typeof generalConfigSchema>;

export type LlmAdapterInputParams<ArgumentsType = GeneralArguments, ConfigType = GeneralConfig> = {
  args?: ArgumentsType;
  argsSchema?: z.ZodType<ArgumentsType>;
  config?: ConfigType;
  configSchema?: z.ZodType<ConfigType>;
};

export type LlmAdapterBuilderInputParams<ClientBuildArgsType = GeneralArguments, AdapterBuildArgsType = GeneralArguments> = {
  buildArgs?: AdapterBuildArgsType;
  buildArgsSchema?: z.ZodType<AdapterBuildArgsType>;
  buildClientInputParams?: LlmAdapterInputParams<ClientBuildArgsType>;
};

// type LlmAdapterResult<ResultType = GeneralResult> = ResultType | undefined;
type LlmAdapterResult<ResultType = GeneralResult> = ResultType;

export type LlmAdapterFunction<InputParamsType = LlmAdapterInputParams, ResultType = GeneralResult> = (
  params?: InputParamsType,
) => LlmAdapterResult<ResultType>;

export type LlmAdapterAsyncFunction<InputParamsType = LlmAdapterInputParams, ResultType = GeneralResult> = (
  params?: InputParamsType,
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

export const chatCompletionsArgsSchema = z.object({
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
export type ChatCompletionsArgs = z.infer<typeof chatCompletionsArgsSchema>;

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

export const speechToTextArgsSchema = z.object({
  audioFilePath: z.string(),
  options: speechToTextOptionsSchema.optional(),
});
export type SpeechToTextArgs = z.infer<typeof speechToTextArgsSchema>;

export const speechToTextResultSchema = z.string();
export type SpeechToTextResult = z.infer<typeof speechToTextResultSchema>;

export const textToSpeechOptionsSchema = z
  .object({
    voice: z.any(),
    responseFormat: z.any().optional(),
  })
  .catchall(z.any());
export type TextToSpeechOptions = z.infer<typeof textToSpeechOptionsSchema>;

export const textToSpeechArgsSchema = z.object({
  message: z.string(),
  options: textToSpeechOptionsSchema.optional(),
});
export type TextToSpeechArgs = z.infer<typeof textToSpeechArgsSchema>;

export const textToSpeechResultSchema = z.object({
  contentType: z.string(),
  content: z.instanceof(Buffer),
});
export type TextToSpeechResult = z.infer<typeof textToSpeechResultSchema>;

export type ChatCompletionsAdapter = {
  chatCompletions: LlmAdapterAsyncFunction<LlmAdapterInputParams<ChatCompletionsArgs>, ChatCompletionsResult>;
};

export type SpeechToTextAdapter = {
  speechToText: LlmAdapterAsyncFunction<LlmAdapterInputParams<SpeechToTextArgs>, SpeechToTextResult>;
};

export type TextToSpeechAdapter = {
  textToSpeech: LlmAdapterAsyncFunction<LlmAdapterInputParams<TextToSpeechArgs>, TextToSpeechResult>;
};

export type LlmAdapter = ChatCompletionsAdapter & Partial<SpeechToTextAdapter & TextToSpeechAdapter>;

export const llmIdSchema = z.enum(["OpenAI", "AzureOpenAI", "Anthropic", "Google", "Groq"]);
export type LlmId = z.infer<typeof llmIdSchema>;

export type LlmAdapterBuilder<ClientBuildArgsType = GeneralArguments, AdapterBuildArgsType = LlmId, ResultType = LlmAdapter> = {
  build: LlmAdapterFunction<LlmAdapterBuilderInputParams<ClientBuildArgsType, AdapterBuildArgsType>, ResultType>;
};

export type LlmClientBuilder<ClientBuildArgsType = GeneralArguments, ResultType = GeneralResult> = {
  build: LlmAdapterFunction<LlmAdapterInputParams<ClientBuildArgsType>, ResultType>;
};
