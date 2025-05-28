"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAdapter = void 0;
const fs_1 = require("fs");
const zod_1 = require("zod");
const generative_ai_1 = require("@google/generative-ai");
class GeminiAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY,
        apiModelChat: process.env.GEMINI_API_MODEL_CHAT,
    }, llmConfigSchema = zod_1.z.object({
        apiKey: zod_1.z.string().min(1, "GEMINI_API_KEY is required"),
        apiModelChat: zod_1.z.string().min(1, "GEMINI_API_MODEL_CHAT is required"),
    })) {
        this.llmConfig = llmConfigSchema.parse(llmConfig);
        this.geminiClient = new generative_ai_1.GoogleGenerativeAI(llmConfig.apiKey);
    }
    // A function to delete parameters such as additionalProperties because the GeminiAPI tool schema does not support jsonSchema7.
    cleanJsonSchema(schema) {
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
                            [propKey]: this.cleanJsonSchema(schema.properties[propKey]),
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
                items: this.cleanJsonSchema(items),
            };
        }
        return schema;
    }
    convertTools(tools) {
        const functions = tools.map((tool) => {
            return {
                name: tool.name,
                description: tool.description,
                parameters: this.cleanJsonSchema(tool.inputSchema),
            };
        });
        // debug
        console.log("[convertTools] functions: ", JSON.stringify(functions, null, 2));
        return [{ functionDeclarations: functions }];
    }
    convertResponseFormatJSONSchema(tool) {
        return {
            responseMimeType: "application/json",
            responseSchema: this.cleanJsonSchema(tool.inputSchema),
        };
    }
    async convertImageUrlToBase64(imageUrl) {
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
    }
    convertMessagesForHistory(messages) {
        return messages.map((message) => ({
            role: message.role,
            parts: message.parts.map((part) => (part.inlineData?.data ? { ...part, inlineData: { ...part.inlineData, data: "ommitted" } } : part)),
        }));
    }
    async chatCompletions(systemPrompt, newMessageContents, options, inProgress) {
        const covertedSystemPrompt = {
            role: "model",
            parts: [],
        };
        systemPrompt.forEach((msg) => {
            covertedSystemPrompt.parts.push({
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
                    const { mimeType, base64Content } = await this.convertImageUrlToBase64(content.image.url);
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
                        tools: this.convertTools(options.tools),
                        toolConfig: {
                            functionCallingConfig: {
                                mode: String(options.toolOption.choice).toUpperCase() || generative_ai_1.FunctionCallingMode.AUTO,
                            },
                        },
                    }
                    : {};
            resFormatOption = options.toolOption.type === "response_format" ? this.convertResponseFormatJSONSchema(options.tools[0]) : {};
        }
        const modelParams = {
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
            generationConfig: {
                maxOutputTokens: options.toolOption.maxTokens || 1028,
                temperature: options.toolOption.temperature ?? 0.7,
                ...resFormatOption,
            },
            model: this.llmConfig.apiModelChat,
            systemInstruction: covertedSystemPrompt,
            ...toolsOption,
        };
        let response = {
            text: "",
            tools: [],
            messages: [],
        };
        try {
            // For history
            const historyMessages = this.convertMessagesForHistory(updatedMessages);
            // debug
            console.log("[chatCompletions] start -- historyMessages: ", JSON.stringify(historyMessages));
            const chatResult = await this.geminiClient.getGenerativeModel(modelParams).generateContent({
                contents: updatedMessages,
            });
            const chatResponse = chatResult.response;
            const text = chatResponse.text();
            const funcCalls = chatResponse.functionCalls();
            const finishReason = chatResponse.candidates && chatResponse.candidates[0].finishReason;
            // debug
            console.log(`[chatCompletions] end -- response.text: ${text} response.functionCalls: ${JSON.stringify(funcCalls)} finishReason: ${finishReason}`);
            let resTools = [];
            if (chatResponse) {
                const parts = [];
                resTools = funcCalls
                    ? funcCalls?.map((funcCall) => {
                        parts.push({ functionCall: funcCall });
                        return {
                            id: "",
                            name: funcCall.name,
                            arguments: JSON.parse(JSON.stringify(funcCall.args)),
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
    async speechToText(__, ___) {
        //================ Not supported
        try {
            return "unsupported";
        }
        catch (error) {
            // debug
            console.log("[speechToText] Error: ", error);
            throw error;
        }
    }
    async textToSpeech(_, options) {
        //================ Not supported
        try {
            const sorryFormat = options?.responseFormat === "wav" || options?.responseFormat === "aac" ? options.responseFormat : "mp3";
            const sorry = await fs_1.promises.readFile(`audio/sorry.ja.${sorryFormat}`);
            const contentType = sorryFormat === "mp3" ? "audio/mpeg" : `audio/${sorryFormat}`;
            return {
                contentType: contentType,
                content: sorry,
            };
        }
        catch (error) {
            // debug
            console.log("[textToSpeech] Error: ", error);
            throw error;
        }
    }
}
exports.GeminiAdapter = GeminiAdapter;
