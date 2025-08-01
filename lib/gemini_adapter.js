"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiAdapterBuilder = void 0;
const zod_1 = require("zod");
const genai_1 = require("@google/genai");
const llm_adapter_schemas_1 = require("./llm_adapter_schemas");
// A function to delete parameters such as additionalProperties because the GeminiAPI tool schema does not support jsonSchema7.
const cleanJsonSchema = (schema) => {
    if (typeof schema !== "object" || schema === null) {
        return schema;
    }
    if (schema.type === "object") {
        const cleanedSchema = {};
        Object.keys(schema).forEach((key) => {
            if (key !== "additionalProperties" && key !== "$schema") {
                if (key === "properties") {
                    cleanedSchema.properties = Object.keys(schema.properties).reduce((acc, propKey) => ({
                        ...acc,
                        [propKey]: cleanJsonSchema(schema.properties[propKey]),
                    }), {});
                }
                else {
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
const convertTools = (tools) => {
    const functions = tools.map((tool) => {
        return {
            name: tool.name,
            description: tool.description,
            parameters: cleanJsonSchema(tool.inputSchema),
        };
    });
    // debug
    console.log("[convertTools] functions: ", JSON.stringify(functions, null, 2));
    return [{ functionDeclarations: functions }];
};
const convertResponseFormatJSONSchema = (tool) => {
    return {
        responseMimeType: "application/json",
        responseSchema: cleanJsonSchema(tool.inputSchema),
    };
};
const convertImageUrlToBase64 = async (imageUrl) => {
    try {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get("content-type") || "image/jpeg";
        const base64Content = buffer.toString("base64");
        return { mimeType, base64Content };
    }
    catch (error) {
        throw new Error(`Failed to fetch or convert image: ${error}`);
    }
};
const convertMessagesForHistory = (messages) => {
    return messages.map((message) => ({
        role: message.role,
        parts: message.parts?.map((part) => (part.inlineData?.data ? { ...part, inlineData: { ...part.inlineData, data: "ommitted" } } : part)),
    }));
};
const geminiClientBuilderArgsSchema = zod_1.z
    .object({
    apiKey: zod_1.z.string().min(1, "GEMINI_API_KEY is required"),
})
    .passthrough();
const geminiClientBuilder = {
    build: ({ args = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    }, argsSchema = geminiClientBuilderArgsSchema, } = {}) => {
        const { apiKey } = argsSchema.parse(args || {});
        return new genai_1.GoogleGenAI({ apiKey });
    },
};
exports.geminiAdapterBuilder = {
    build: ({ buildClientInputParams } = {}) => ({
        chatCompletions: async ({ args, argsSchema = llm_adapter_schemas_1.chatCompletionsArgsSchema, config = {
            apiModelChat: process.env.GEMINI_API_MODEL_CHAT,
        }, configSchema = zod_1.z.object({
            apiModelChat: zod_1.z.string().min(1, "GEMINI_API_MODEL_CHAT is required"),
        }), } = {}) => {
            const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
            const { apiModelChat } = configSchema.parse(config || {});
            const covertedSystemPrompt = {
                role: "model",
                parts: [],
            };
            systemPrompt.forEach((msg) => {
                covertedSystemPrompt.parts?.push({
                    text: msg,
                });
            });
            let updatedMessages = [];
            if (inProgress) {
                const resParts = inProgress.toolResults?.map((toolResult) => {
                    return { text: toolResult.content };
                }) || [];
                updatedMessages = inProgress.messages.concat({ role: "user", parts: resParts });
            }
            if (newMessageContents.length > 0) {
                const resParts = await Promise.all(newMessageContents.map(async (content) => {
                    if (content.image) {
                        const { mimeType, base64Content } = await convertImageUrlToBase64(content.image.url);
                        return {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Content,
                            },
                        };
                    }
                    else {
                        return { text: content.text || "" };
                    }
                }));
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
                                        ? String(options.toolOption.choice).toUpperCase()
                                        : genai_1.FunctionCallingConfigMode.AUTO,
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
                                category: genai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                                threshold: genai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
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
                let resTools = [];
                if (funcCalls) {
                    const parts = [];
                    resTools =
                        funcCalls
                            .filter((funcCall) => funcCall.name !== undefined)
                            .map((funcCall) => {
                            parts.push({ functionCall: funcCall });
                            return {
                                id: "",
                                name: funcCall.name,
                                arguments: JSON.parse(JSON.stringify(funcCall.args)),
                            };
                        }) || [];
                    historyMessages.push({ role: "model", parts });
                }
                response = {
                    text: text,
                    tools: resTools,
                    messages: historyMessages,
                };
            }
            catch (error) {
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
