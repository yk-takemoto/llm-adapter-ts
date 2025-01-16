"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAdapter = void 0;
const fs_1 = require("fs");
const generative_ai_1 = require("@google/generative-ai");
class GeminiAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
        apiModelChat: process.env.GEMINI_API_MODEL_CHAT,
    }) {
        this.llmConfig = llmConfig;
        this.initCheck(llmConfig);
        this.geminiClient = new generative_ai_1.GoogleGenerativeAI(llmConfig.apiKey);
    }
    initCheck(llmConfig) {
        for (const key of Object.keys(this.llmConfig)) {
            if (!llmConfig[key]) {
                throw new Error(`llmConfig.${key} is required but not set.`);
            }
        }
    }
    convertTools(tools) {
        const functions = tools.map((tool) => {
            return {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
            };
        });
        return [{ functionDeclarations: functions }];
    }
    convertResponseFormatJSONSchema(tool) {
        return {
            responseMimeType: "application/json",
            responseSchema: tool.inputSchema,
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
    async chatCompletions(systemPrompt, firstMessageContents, options, inProgress) {
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
        else {
            const resParts = await Promise.all(firstMessageContents.map(async (content) => {
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
                options.purposeOfTools === "function"
                    ? {
                        tools: this.convertTools(options.tools),
                        toolConfig: {
                            functionCallingConfig: {
                                mode: String(options.toolChoice).toUpperCase() || generative_ai_1.FunctionCallingMode.AUTO,
                            },
                        },
                    }
                    : {};
            resFormatOption = options.purposeOfTools === "response_format" ? this.convertResponseFormatJSONSchema(options.tools[0]) : {};
        }
        const modelParams = {
            safetySettings: [
                {
                    category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: generative_ai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                },
            ],
            generationConfig: {
                maxOutputTokens: options.maxTokens || 1028,
                temperature: options.temperature ?? 0.7,
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
