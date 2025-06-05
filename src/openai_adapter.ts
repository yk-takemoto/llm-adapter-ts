import OpenAI, { AzureOpenAI } from "openai";
import { createReadStream } from "fs";
import { z } from "zod";
import {
  McpTool,
  LlmAdapterInputParams,
  LlmAdapterBuilder,
  LlmClientBuilder,
  chatCompletionsArgsSchema,
  speechToTextArgsSchema,
  textToSpeechArgsSchema,
} from "@/llm_adapter_schemas";

const addAdditionalPropertiesElementToObjectType = (schema: any, bool: boolean = false) => {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }
  if (schema.type === "object") {
    schema.additionalProperties = bool;
    if (schema.properties) {
      for (const key in schema.properties) {
        schema.properties[key] = addAdditionalPropertiesElementToObjectType(schema.properties[key], bool);
      }
    }
  }
  if (schema.type === "array" && schema.items) {
    schema.items = addAdditionalPropertiesElementToObjectType(schema.items, bool);
  }
  return schema;
};

const convertTools = (tools: McpTool[], isStrict?: boolean): OpenAI.ChatCompletionTool[] => {
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
        parameters: isStrict ? addAdditionalPropertiesElementToObjectType(tool.inputSchema, !isStrict) : tool.inputSchema,
      },
    };
  });
};

const convertResponseFormatJSONSchema = (tool: McpTool): OpenAI.ResponseFormatJSONSchema => {
  return {
    type: "json_schema",
    json_schema: {
      name: tool.name,
      description: tool.description,
      strict: true,
      schema: addAdditionalPropertiesElementToObjectType(tool.inputSchema, false),
    },
  };
};

const openAIClientBuilderArgsSchema = z.object({
  apiKey: z.string().min(1, "OPENAI_API_KEY is required"),
}).passthrough();
const azureOpenAIClientBuilderArgsSchema = z.object({
  apiKey: z.string().min(1, "AZURE_OPENAI_API_KEY is required"),
  endpoint: z.string().min(1, "AZURE_OPENAI_ENDPOINT is required"),
  apiVersion: z.string().min(1, "OPENAI_API_VERSION is required"),
}).passthrough();
type OpenAIClientBuilderArgs = z.infer<typeof openAIClientBuilderArgsSchema>;
type AzureOpenAIClientBuilderArgs = z.infer<typeof azureOpenAIClientBuilderArgsSchema>;

const openAIClientBuilder: LlmClientBuilder<OpenAIClientBuilderArgs, OpenAI> = {
  build: ({
    args = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    },
    argsSchema = openAIClientBuilderArgsSchema,
  } = {}) => {
    const parsedArgs = argsSchema.parse(args || {});
    return new OpenAI(parsedArgs);
  },
};

const azureOpenAIClientBuilder: LlmClientBuilder<AzureOpenAIClientBuilderArgs, AzureOpenAI> = {
  build: ({
    args = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.OPENAI_API_VERSION,
    },
    argsSchema = azureOpenAIClientBuilderArgsSchema,
  } = {}) => {
    const parsedArgs = argsSchema.parse(args || {});
    return new AzureOpenAI(parsedArgs);
  },
};

const getClient = (llmId: any, buildClientInputParams?: LlmAdapterInputParams<OpenAIClientBuilderArgs | AzureOpenAIClientBuilderArgs>) => {
  return llmId === "AzureOpenAI" ? azureOpenAIClientBuilder.build(buildClientInputParams as LlmAdapterInputParams<AzureOpenAIClientBuilderArgs> || {}) : openAIClientBuilder.build(buildClientInputParams as LlmAdapterInputParams<OpenAIClientBuilderArgs> || {});
};

export const openAIAdapterBuilder: LlmAdapterBuilder<OpenAIClientBuilderArgs | AzureOpenAIClientBuilderArgs> = {
  build: ({ buildArgs = "OpenAI", buildArgsSchema = z.enum(["OpenAI", "AzureOpenAI"]), buildClientInputParams } = {}) => ({
    chatCompletions: async ({
      args,
      argsSchema = chatCompletionsArgsSchema,
      config = {
        apiModelChat: buildArgs === "AzureOpenAI" ? process.env.AZURE_OPENAI_API_DEPLOYMENT_CHAT : process.env.OPENAI_API_MODEL_CHAT,
      },
      configSchema = z.object({
        apiModelChat: z.string().min(1, "OPENAI_API_MODEL_CHAT or AZURE_OPENAI_API_DEPLOYMENT_CHAT is required"),
      }),
    } = {}) => {
      const llmId = buildArgsSchema.parse(buildArgs);
      const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
      const { apiModelChat } = configSchema.parse(config || {});

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
          options.toolOption.type === "function" || options.toolOption.type === "function_strict"
            ? {
                tools: convertTools(options.tools, options.toolOption.type === "function_strict"),
                tool_choice: options.toolOption.choice || ("auto" as OpenAI.ChatCompletionToolChoiceOption),
              }
            : {};
        resFormatOption =
          options.toolOption.type === "response_format"
            ? {
                response_format: convertResponseFormatJSONSchema(options.tools[0]),
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
        const openaiClient = getClient(llmId, buildClientInputParams);
        const chatResponse = await openaiClient.chat.completions.create(chatOtions);
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
        apiModelAudioTranscription:
          buildArgs === "AzureOpenAI" ? process.env.AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION : process.env.OPENAI_API_MODEL_AUDIO_TRANSCRIPTION,
      },
      configSchema = z.object({
        apiModelAudioTranscription: z.string().min(1, "OPENAI_API_MODEL_AUDIO_TRANSCRIPTION or AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION is required"),
      }),
    } = {}) => {
      const llmId = buildArgsSchema.parse(buildArgs);
      const { audioFilePath, options } = argsSchema.parse(args);
      const { apiModelAudioTranscription } = configSchema.parse(config);

      const speechOtions = {
        file: createReadStream(audioFilePath),
        model: apiModelAudioTranscription,
        language: options?.language || "ja",
      };
      try {
        const openaiClient = getClient(llmId, buildClientInputParams);
        const response = await openaiClient.audio.transcriptions.create(speechOtions);
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
        apiModelText2Speech: buildArgs === "AzureOpenAI" ? process.env.AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH : process.env.OPENAI_API_MODEL_TEXT2SPEECH,
      },
      configSchema = z.object({
        apiModelText2Speech: z.string().min(1, "OPENAI_API_MODEL_TEXT2SPEECH or AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH is required"),
      }),
    } = {}) => {
      const llmId = buildArgsSchema.parse(buildArgs);
      const { message, options } = argsSchema.parse(args);
      const { apiModelText2Speech } = configSchema.parse(config);

      const speechOtions = {
        model: apiModelText2Speech as string,
        input: message,
        voice: options?.voice || "alloy",
        response_format: options?.responseFormat || "mp3",
      };
      try {
        const openaiClient = getClient(llmId, buildClientInputParams);
        const response = await openaiClient.audio.speech.create(speechOtions);
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await response.arrayBuffer();
        return {
          contentType: contentType,
          content: Buffer.from(arrayBuffer),
        };
      } catch (error) {
        // debug
        console.log("[textToSpeech] Error: ", error);
        throw error;
      }
    },
  }),
};
