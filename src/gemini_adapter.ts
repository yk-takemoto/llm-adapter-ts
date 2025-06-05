import { z } from "zod";
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
import { McpTool, LlmAdapterBuilder, LlmClientBuilder, chatCompletionsArgsSchema } from "@/llm_adapter_schemas";

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
    responseSchema: cleanJsonSchema(tool.inputSchema) as ResponseSchema,
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
    parts: message.parts.map((part) => (part.inlineData?.data ? ({ ...part, inlineData: { ...part.inlineData, data: "ommitted" } } as Part) : part)),
  }));
};

const geminiClientBuilderArgsSchema = z
  .object({
    apiKey: z.string().min(1, "GEMINI_API_KEY is required"),
  })
  .passthrough();
export type GeminiClientBuilderArgs = z.infer<typeof geminiClientBuilderArgsSchema>;

const geminiClientBuilder: LlmClientBuilder<GeminiClientBuilderArgs, GoogleGenerativeAI> = {
  build: ({
    args = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    },
    argsSchema = geminiClientBuilderArgsSchema,
  } = {}) => {
    const { apiKey } = argsSchema.parse(args || {});
    return new GoogleGenerativeAI(apiKey);
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
                    mode: options.toolOption.choice ? (String(options.toolOption.choice).toUpperCase() as FunctionCallingMode) : FunctionCallingMode.AUTO,
                  },
                },
              }
            : {};
        resFormatOption = options.toolOption.type === "response_format" ? convertResponseFormatJSONSchema(options.tools[0]) : {};
      }

      const modelParams: ModelParams = {
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
        generationConfig: {
          maxOutputTokens: options.toolOption.maxTokens || 1028,
          temperature: options.toolOption.temperature ?? 0.7,
          ...resFormatOption,
        },
        model: apiModelChat,
        systemInstruction: covertedSystemPrompt,
        ...toolsOption,
      };
      let response;
      try {
        // For history
        const historyMessages = convertMessagesForHistory(updatedMessages);

        // debug
        console.log("[chatCompletions] start -- historyMessages: ", JSON.stringify(historyMessages));

        const geminiClient = geminiClientBuilder.build(buildClientInputParams || {});
        const chatResult = await geminiClient.getGenerativeModel(modelParams).generateContent({
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
    },
  }),
};
