"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAIAdapterBuilder = void 0;
const openai_1 = __importStar(require("openai"));
const fs_1 = require("fs");
const zod_1 = require("zod");
const llm_adapter_schemas_1 = require("./llm_adapter_schemas");
const addAdditionalPropertiesElementToObjectType = (schema, bool = false) => {
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
const convertTools = (tools, isStrict) => {
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
const convertResponseFormatJSONSchema = (tool) => {
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
const openAIClientBuilderArgsSchema = zod_1.z
    .object({
    apiKey: zod_1.z.string().min(1, "OPENAI_API_KEY is required"),
})
    .passthrough();
const azureOpenAIClientBuilderArgsSchema = zod_1.z
    .object({
    apiKey: zod_1.z.string().min(1, "AZURE_OPENAI_API_KEY is required"),
    endpoint: zod_1.z.string().min(1, "AZURE_OPENAI_ENDPOINT is required"),
    apiVersion: zod_1.z.string().min(1, "OPENAI_API_VERSION is required"),
})
    .passthrough();
const openAIClientBuilder = {
    build: ({ args = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    }, argsSchema = openAIClientBuilderArgsSchema, } = {}) => {
        const parsedArgs = argsSchema.parse(args || {});
        return new openai_1.default(parsedArgs);
    },
};
const azureOpenAIClientBuilder = {
    build: ({ args = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION,
    }, argsSchema = azureOpenAIClientBuilderArgsSchema, } = {}) => {
        const parsedArgs = argsSchema.parse(args || {});
        return new openai_1.AzureOpenAI(parsedArgs);
    },
};
const getClient = (llmId, buildClientInputParams) => {
    return llmId === "AzureOpenAI"
        ? azureOpenAIClientBuilder.build(buildClientInputParams || {})
        : openAIClientBuilder.build(buildClientInputParams || {});
};
exports.openAIAdapterBuilder = {
    build: ({ buildArgs = "OpenAI", buildArgsSchema = zod_1.z.enum(["OpenAI", "AzureOpenAI"]), buildClientInputParams } = {}) => ({
        chatCompletions: async ({ args, argsSchema = llm_adapter_schemas_1.chatCompletionsArgsSchema, config = {
            apiModelChat: buildArgs === "AzureOpenAI" ? process.env.AZURE_OPENAI_API_DEPLOYMENT_CHAT : process.env.OPENAI_API_MODEL_CHAT,
        }, configSchema = zod_1.z.object({
            apiModelChat: zod_1.z.string().min(1, "OPENAI_API_MODEL_CHAT or AZURE_OPENAI_API_DEPLOYMENT_CHAT is required"),
        }), } = {}) => {
            const llmId = buildArgsSchema.parse(buildArgs);
            const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
            const { apiModelChat } = configSchema.parse(config || {});
            let updatedMessages = [];
            if (inProgress) {
                const resMessages = inProgress.toolResults?.map((toolResult) => {
                    return {
                        tool_call_id: toolResult.id,
                        role: "tool",
                        content: toolResult.content,
                    };
                }) || [];
                updatedMessages = inProgress.messages.concat(resMessages);
            }
            else {
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
                            tool_choice: options.toolOption.choice || "auto",
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
                let resTools = [];
                if (choice.message) {
                    updatedMessages.push(choice.message);
                    resTools =
                        finishReason === "tool_calls"
                            ? choice.message.tool_calls?.map((tool_call) => {
                                return {
                                    id: tool_call.id,
                                    name: tool_call.function.name,
                                    arguments: JSON.parse(tool_call.function.arguments),
                                };
                            }) || []
                            : [];
                }
                response = {
                    text: choice.message?.content,
                    tools: resTools,
                    messages: updatedMessages,
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
        speechToText: async ({ args, argsSchema = llm_adapter_schemas_1.speechToTextArgsSchema, config = {
            apiModelAudioTranscription: buildArgs === "AzureOpenAI" ? process.env.AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION : process.env.OPENAI_API_MODEL_AUDIO_TRANSCRIPTION,
        }, configSchema = zod_1.z.object({
            apiModelAudioTranscription: zod_1.z.string().min(1, "OPENAI_API_MODEL_AUDIO_TRANSCRIPTION or AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION is required"),
        }), } = {}) => {
            const llmId = buildArgsSchema.parse(buildArgs);
            const { audioFilePath, options } = argsSchema.parse(args);
            const { apiModelAudioTranscription } = configSchema.parse(config);
            const speechOtions = {
                file: (0, fs_1.createReadStream)(audioFilePath),
                model: apiModelAudioTranscription,
                language: options?.language || "ja",
            };
            try {
                const openaiClient = getClient(llmId, buildClientInputParams);
                const response = await openaiClient.audio.transcriptions.create(speechOtions);
                return response.text;
            }
            catch (error) {
                // debug
                console.log("[speechToText] Error: ", error);
                throw error;
            }
        },
        textToSpeech: async ({ args, argsSchema = llm_adapter_schemas_1.textToSpeechArgsSchema, config = {
            apiModelText2Speech: buildArgs === "AzureOpenAI" ? process.env.AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH : process.env.OPENAI_API_MODEL_TEXT2SPEECH,
        }, configSchema = zod_1.z.object({
            apiModelText2Speech: zod_1.z.string().min(1, "OPENAI_API_MODEL_TEXT2SPEECH or AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH is required"),
        }), } = {}) => {
            const llmId = buildArgsSchema.parse(buildArgs);
            const { message, options } = argsSchema.parse(args);
            const { apiModelText2Speech } = configSchema.parse(config);
            const speechOtions = {
                model: apiModelText2Speech,
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
            }
            catch (error) {
                // debug
                console.log("[textToSpeech] Error: ", error);
                throw error;
            }
        },
    }),
};
