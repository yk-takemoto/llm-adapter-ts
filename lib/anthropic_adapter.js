"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = void 0;
const fs_1 = require("fs");
const zod_1 = require("zod");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
class AnthropicAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
        apiModelChat: process.env.ANTHROPIC_API_MODEL_CHAT,
    }, llmConfigSchema = zod_1.z.object({
        apiKey: zod_1.z.string().min(1, "ANTHROPIC_API_KEY is required"),
        apiModelChat: zod_1.z.string().min(1, "ANTHROPIC_API_MODEL_CHAT is required"),
    })) {
        this.llmConfig = llmConfigSchema.parse(llmConfig);
        this.anthropicClient = new sdk_1.default({ apiKey: llmConfig.apiKey });
    }
    convertTools(tools) {
        return tools.map((tool) => {
            return {
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema,
            };
        });
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
            content: Array.isArray(message.content)
                ? message.content.map((item) => item.type === "image" ? { ...item, source: { ...item.source, data: "ommitted" } } : item)
                : message.content,
        }));
    }
    async chatCompletions(systemPrompt, newMessageContents, options, inProgress) {
        const covertedSystemPrompt = [];
        systemPrompt.forEach((msg) => {
            covertedSystemPrompt.push({
                type: "text",
                text: msg,
            });
        });
        let updatedMessages = [];
        if (inProgress) {
            const resMessages = inProgress.toolResults?.map((toolResult) => {
                return {
                    tool_use_id: toolResult.id,
                    type: "tool_result",
                    content: toolResult.content,
                };
            }) || [];
            updatedMessages = inProgress.messages.concat({ role: "user", content: resMessages });
        }
        if (newMessageContents.length > 0) {
            const list = await Promise.all(newMessageContents.map(async (content) => {
                if (content.image) {
                    const { mimeType, base64Content } = await this.convertImageUrlToBase64(content.image.url);
                    return {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: mimeType,
                            data: base64Content,
                        },
                    };
                }
                else {
                    return {
                        type: "text",
                        text: content.text || "",
                    };
                }
            }));
            updatedMessages.push({
                role: "user",
                content: list,
            });
        }
        const toolsOption = options.tools && options.tools.length > 0
            ? {
                tools: this.convertTools(options.tools),
                tool_choice: { type: options.toolOption.choice || "auto" },
            }
            : {};
        const chatOtions = {
            model: this.llmConfig.apiModelChat,
            messages: updatedMessages,
            system: covertedSystemPrompt,
            max_tokens: options.toolOption.maxTokens || 1028,
            temperature: options.toolOption.temperature ?? 0.7,
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
            console.log("[chatCompletions] start -- covertedSystemPrompt: ", JSON.stringify(covertedSystemPrompt), " -- historyMessages: ", JSON.stringify(historyMessages));
            const chatResponse = await this.anthropicClient.messages.create(chatOtions);
            const contents = chatResponse.content;
            const stopReason = chatResponse.stop_reason;
            // debug
            console.log(`[chatCompletions] end -- contents: ${JSON.stringify(contents)} stopReason: ${stopReason}`);
            let resTools = [];
            if (chatResponse) {
                historyMessages.push({
                    role: chatResponse.role,
                    content: contents,
                });
                resTools =
                    stopReason === "tool_use"
                        ? contents
                            ?.filter((contentBlock) => contentBlock.type === "tool_use")
                            .map((contentBlock) => {
                            return {
                                id: contentBlock.id,
                                name: contentBlock.name,
                                arguments: JSON.parse(JSON.stringify(contentBlock.input)),
                            };
                        }) || []
                        : [];
            }
            response = {
                text: resTools.length > 0 && options.toolOption.type === "response_format"
                    ? JSON.stringify(resTools[0].arguments)
                    : contents[0].text || null,
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
exports.AnthropicAdapter = AnthropicAdapter;
