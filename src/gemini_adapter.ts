import { z } from "zod";
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Content,
  FunctionDeclaration,
  Tool,
  FunctionCallingConfigMode,
  GenerationConfig,
  Schema,
  Part,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import {
  McpTool,
  LlmAdapterBuilder,
  LlmClientBuilder,
  chatCompletionsArgsSchema,
  embeddingArgsSchema,
  textToSpeechArgsSchema,
  speechToTextArgsSchema,
} from "@/llm_adapter_schemas";

// A function to delete parameters such as additionalProperties because the GeminiAPI tool schema does not support jsonSchema7.
const cleanJsonSchema = (schema: Record<string, any>): Record<string, any> => {
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
              [propKey]: cleanJsonSchema(schema.properties[propKey]),
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
      items: cleanJsonSchema(items),
    };
  }
  return schema;
};

const convertTools = (tools: McpTool[]): Tool[] => {
  const functions = tools.map((tool) => {
    return {
      name: tool.name,
      description: tool.description,
      parameters: cleanJsonSchema(tool.inputSchema),
    } as FunctionDeclaration;
  });
  // debug
  console.log("[convertTools] functions: ", JSON.stringify(functions, null, 2));
  return [{ functionDeclarations: functions }];
};

const convertResponseFormatJSONSchema = (tool: McpTool): GenerationConfig => {
  return {
    responseMimeType: "application/json",
    responseSchema: cleanJsonSchema(tool.inputSchema) as Schema,
  };
};

const convertImageUrlToBase64 = async (
  imageUrl: string,
): Promise<{
  mimeType: string;
  base64Content: string;
}> => {
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
};

const convertMessagesForHistory = (messages: Content[]): Content[] => {
  return messages.map((message) => ({
    role: message.role,
    parts: message.parts?.map((part) => (part.inlineData?.data ? ({ ...part, inlineData: { ...part.inlineData, data: "ommitted" } } as Part) : part)),
  }));
};

const createWavHeader = (dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer => {
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((channels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
};

const geminiClientBuilderArgsSchema = z
  .object({
    apiKey: z.string().min(1, "GEMINI_API_KEY is required"),
  })
  .passthrough();
export type GeminiClientBuilderArgs = z.infer<typeof geminiClientBuilderArgsSchema>;

const geminiClientBuilder: LlmClientBuilder<GeminiClientBuilderArgs, GoogleGenAI> = {
  build: ({
    args = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    },
    argsSchema = geminiClientBuilderArgsSchema,
  } = {}) => {
    const { apiKey } = argsSchema.parse(args || {});
    return new GoogleGenAI({ apiKey });
  },
};

export const geminiAdapterBuilder: LlmAdapterBuilder<GeminiClientBuilderArgs> = {
  build: ({ buildClientInputParams } = {}) => ({
    chatCompletions: async ({
      args,
      argsSchema = chatCompletionsArgsSchema,
      config = {
        apiModelChat: process.env.GEMINI_API_MODEL_CHAT,
      },
      configSchema = z.object({
        apiModelChat: z.string().min(1, "GEMINI_API_MODEL_CHAT is required"),
      }),
    } = {}) => {
      const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
      const { apiModelChat } = configSchema.parse(config || {});

      const covertedSystemPrompt: Content = {
        role: "model",
        parts: [],
      };
      systemPrompt.forEach((msg) => {
        covertedSystemPrompt.parts?.push({
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
      }
      if (newMessageContents.length > 0) {
        const resParts = await Promise.all(
          newMessageContents.map(async (content) => {
            if (content.image) {
              const { mimeType, base64Content } = await convertImageUrlToBase64(content.image.url);
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
          options.toolOption.type === "function" || options.toolOption.type === "function_strict"
            ? {
                tools: convertTools(options.tools),
                toolConfig: {
                  functionCallingConfig: {
                    mode: options.toolOption.choice
                      ? (String(options.toolOption.choice).toUpperCase() as FunctionCallingConfigMode)
                      : FunctionCallingConfigMode.AUTO,
                  },
                },
              }
            : {};
        resFormatOption = options.toolOption.type === "response_format" ? convertResponseFormatJSONSchema(options.tools[0]) : {};
      }

      // const modelParams: ModelParams = {
      //   safetySettings: [
      //     {
      //       category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      //       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      //     },
      //   ],
      //   generationConfig: {
      //     maxOutputTokens: options.toolOption.maxTokens || 1028,
      //     temperature: options.toolOption.temperature ?? 0.7,
      //     ...resFormatOption,
      //   },
      //   model: apiModelChat,
      //   systemInstruction: covertedSystemPrompt,
      //   ...toolsOption,
      // };
      let response;
      try {
        // For history
        const historyMessages = convertMessagesForHistory(updatedMessages);

        // debug
        console.log("[chatCompletions] start -- historyMessages: ", JSON.stringify(historyMessages));

        const geminiClient = geminiClientBuilder.build(buildClientInputParams || {});
        const chatResult = await geminiClient.models.generateContent({
          model: apiModelChat,
          contents: updatedMessages,
          config: {
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
            maxOutputTokens: options.toolOption.maxTokens || 1028,
            temperature: options.toolOption.temperature ?? 0.7,
            systemInstruction: covertedSystemPrompt,
            ...resFormatOption,
            ...toolsOption,
          },
        });
        const text = chatResult.text || null;
        const funcCalls = chatResult.functionCalls;
        const finishReason = chatResult.candidates && chatResult.candidates[0].finishReason;
        // debug
        console.log(`[chatCompletions] end -- response.text: ${text} response.functionCalls: ${JSON.stringify(funcCalls)} finishReason: ${finishReason}`);

        let resTools: { id: string; name: string; arguments: Record<string, any> }[] = [];
        if (funcCalls) {
          const parts: Part[] = [];
          resTools =
            funcCalls
              .filter((funcCall): funcCall is typeof funcCall & { name: string } => funcCall.name !== undefined)
              .map((funcCall) => {
                parts.push({ functionCall: funcCall });
                return {
                  id: "",
                  name: funcCall.name,
                  arguments: JSON.parse(JSON.stringify(funcCall.args)) as Record<string, any>,
                };
              }) || [];
          historyMessages.push({ role: "model", parts });
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
    },
    speechToText: async ({
      args,
      argsSchema = speechToTextArgsSchema,
      config = {
        apiModelAudioTranscription: process.env.GEMINI_API_MODEL_AUDIO_TRANSCRIPTION,
      },
      configSchema = z.object({
        apiModelAudioTranscription: z.string().min(1, "GEMINI_API_MODEL_AUDIO_TRANSCRIPTION is required"),
      }),
    } = {}) => {
      const { audioFilePath, options } = argsSchema.parse(args);
      const { apiModelAudioTranscription } = configSchema.parse(config);

      try {
        const geminiClient = geminiClientBuilder.build(buildClientInputParams || {});
        const audioFile = await geminiClient.files.upload({
          file: audioFilePath,
        });
        if (!audioFile?.uri || !audioFile?.mimeType) {
          throw new Error("Audio file upload failed or returned invalid data.");
        }
        const additionalPrompt = options?.language ? ` The language code of the audio is ${options.language}.` : "";
        const prompt = "Generate a transcript of the speech." + additionalPrompt;
        const response = await geminiClient.models.generateContent({
          model: apiModelAudioTranscription,
          contents: createUserContent([createPartFromUri(audioFile.uri, audioFile.mimeType), prompt]),
        });

        return response.text || "";
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
        apiModelText2Speech: process.env.GEMINI_API_MODEL_TEXT2SPEECH,
      },
      configSchema = z.object({
        apiModelText2Speech: z.string().min(1, "GEMINI_API_MODEL_TEXT2SPEECH is required"),
      }),
    } = {}) => {
      const { message, options } = argsSchema.parse(args);
      const { apiModelText2Speech } = configSchema.parse(config);

      const speechOtions = {
        model: apiModelText2Speech as string,
        contents: [{ parts: [{ text: message }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: options?.voice || "Kore" },
            },
          },
        },
      };
      try {
        const geminiClient = geminiClientBuilder.build(buildClientInputParams || {});
        const response = await geminiClient.models.generateContent(speechOtions);
        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) {
          throw new Error("No audio data returned from Gemini API.");
        }

        const result: { contentType: string; content: Buffer } = {
          contentType: response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "application/octet-stream",
          content: Buffer.from(data, "base64url"),
        };
        if (options?.responseFormat === "wav") {
          const audioBuffer = Buffer.from(data, "base64url");
          const wavHeader = createWavHeader(audioBuffer.length, 24000, 1, 16);
          const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);
          result.contentType = "audio/wav";
          result.content = wavBuffer;
        }

        return result;
      } catch (error) {
        // debug
        console.log("[textToSpeech] Error: ", error);
        throw error;
      }
    },
    embedding: async ({
      args,
      argsSchema = embeddingArgsSchema,
      config = {
        apiModelEmbedding: process.env.GEMINI_API_MODEL_EMBEDDING,
      },
      configSchema = z.object({
        apiModelEmbedding: z.string().min(1, "GEMINI_API_MODEL_EMBEDDING is required"),
      }),
    } = {}) => {
      const { text, options } = argsSchema.parse(args);
      const { apiModelEmbedding } = configSchema.parse(config);

      const embeddingOtions = {
        model: apiModelEmbedding as string,
        contents: text,
        config: {
          ...(options?.dimensions ? { outputDimensionality: options.dimensions } : {}),
        },
      };
      try {
        const geminiClient = geminiClientBuilder.build(buildClientInputParams || {});
        const response = await geminiClient.models.embedContent(embeddingOtions);
        return {
          embedding: response.embeddings ? response.embeddings[0].values || [] : [],
        };
      } catch (error) {
        // debug
        console.log("[embedding] Error: ", error);
        throw error;
      }
    },
  }),
};
