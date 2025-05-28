"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAdapter = void 0;
const openai_1 = __importDefault(require("openai"));
const fs_1 = require("fs");
const zod_1 = require("zod");
class OpenAIAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").OPENAI_API_KEY || process.env.OPENAI_API_KEY,
        apiModelChat: process.env.OPENAI_API_MODEL_CHAT,
        apiModelAudioTranscription: process.env.OPENAI_API_MODEL_AUDIO_TRANSCRIPTION,
        apiModelText2Speech: process.env.OPENAI_API_MODEL_TEXT2SPEECH,
    }, llmConfigSchema = zod_1.z.object({
        apiKey: zod_1.z.string().min(1, "OPENAI_API_KEY is required"),
        apiModelChat: zod_1.z.string().min(1, "OPENAI_API_MODEL_CHAT is required"),
        apiModelAudioTranscription: zod_1.z.string().optional(),
        apiModelText2Speech: zod_1.z.string().optional(),
    }), apiClient) {
        this.llmConfig = llmConfigSchema.parse(llmConfig);
        this.openaiClient = apiClient || new openai_1.default({ apiKey: llmConfig.apiKey });
    }
    addAdditionalPropertiesElementToObjectType(schema, bool = false) {
        if (typeof schema !== "object" || schema === null) {
            return schema;
        }
        if (schema.type === "object") {
            schema.additionalProperties = bool;
            if (schema.properties) {
                for (const key in schema.properties) {
                    schema.properties[key] = this.addAdditionalPropertiesElementToObjectType(schema.properties[key], bool);
                }
            }
        }
        if (schema.type === "array" && schema.items) {
            schema.items = this.addAdditionalPropertiesElementToObjectType(schema.items, bool);
        }
        return schema;
    }
    convertTools(tools, isStrict) {
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
                    parameters: isStrict ? this.addAdditionalPropertiesElementToObjectType(tool.inputSchema, !isStrict) : tool.inputSchema,
                },
            };
        });
    }
    convertResponseFormatJSONSchema(tool) {
        return {
            type: "json_schema",
            json_schema: {
                name: tool.name,
                description: tool.description,
                strict: true,
                schema: this.addAdditionalPropertiesElementToObjectType(tool.inputSchema, false),
            },
        };
    }
    async chatCompletions(systemPrompt, newMessageContents, options, inProgress) {
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
                        tools: this.convertTools(options.tools, options.toolOption.type === "function_strict"),
                        tool_choice: options.toolOption.choice || "auto",
                    }
                    : {};
            resFormatOption =
                options.toolOption.type === "response_format"
                    ? {
                        response_format: this.convertResponseFormatJSONSchema(options.tools[0]),
                    }
                    : {};
        }
        const chatOtions = {
            model: this.llmConfig.apiModelChat,
            messages: updatedMessages,
            max_tokens: options.toolOption.maxTokens || 1028,
            temperature: options.toolOption.temperature ?? 0.7,
            ...toolsOption,
            ...resFormatOption,
        };
        let response = {
            text: "",
            tools: [],
            messages: [],
        };
        try {
            // debug
            console.log("[chatCompletions] start -- updatedMessages: ", JSON.stringify(updatedMessages));
            const chatResponse = await this.openaiClient.chat.completions.create(chatOtions);
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
    }
    async speechToText(audioFilePath, options) {
        const speechOtions = {
            file: (0, fs_1.createReadStream)(audioFilePath),
            model: this.llmConfig.apiModelAudioTranscription || "whisper-1",
            language: options?.language || "ja",
        };
        try {
            const response = await this.openaiClient.audio.transcriptions.create(speechOtions);
            return response.text;
        }
        catch (error) {
            // debug
            console.log("[speechToText] Error: ", error);
            throw error;
        }
    }
    async textToSpeech(message, options) {
        const speechOtions = {
            model: this.llmConfig.apiModelText2Speech || "tts-1",
            input: message,
            voice: options?.voice || "alloy",
            response_format: options?.responseFormat || "mp3",
        };
        try {
            const response = await this.openaiClient.audio.speech.create(speechOtions);
            const contentType = response.headers.get("content-type");
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
    }
}
exports.OpenAIAdapter = OpenAIAdapter;
