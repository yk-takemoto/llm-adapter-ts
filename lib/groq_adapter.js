"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqAdapter = void 0;
const fs_1 = require("fs");
const groq_sdk_1 = require("groq-sdk");
const zod_1 = require("zod");
class GroqAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GROQ_API_KEY || process.env.GROQ_API_KEY,
        apiModelChat: process.env.GROQ_API_MODEL_CHAT,
    }, llmConfigSchema = zod_1.z.object({
        apiKey: zod_1.z.string().min(1, "GROQ_API_KEY is required"),
        apiModelChat: zod_1.z.string().min(1, "GROQ_API_MODEL_CHAT is required"),
    })) {
        this.llmConfig = llmConfigSchema.parse(llmConfig);
        this.groqClient = new groq_sdk_1.Groq({ apiKey: llmConfig.apiKey });
    }
    convertTools(tools) {
        return tools.map((tool) => {
            return {
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                },
            };
        });
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
            // Solutions to the following issues:
            // "prompting with images is incompatible with system messages"
            const hasImage = newMessageContents.some((content) => content.image);
            if (hasImage) {
                updatedMessages.push({
                    role: "user",
                    content: systemPrompt.map((msg) => {
                        return {
                            type: "text",
                            text: msg,
                        };
                    }),
                });
            }
            else {
                systemPrompt.forEach((msg) => {
                    updatedMessages.push({
                        role: "system",
                        content: msg,
                    });
                });
            }
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
                        tools: this.convertTools(options.tools),
                        tool_choice: options.toolOption.choice || "auto",
                    }
                    : {};
            resFormatOption =
                options.toolOption.type === "response_format"
                    ? {
                        response_format: {
                            type: "json_object",
                        },
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
            const chatResponse = await this.groqClient.chat.completions.create(chatOtions);
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
exports.GroqAdapter = GroqAdapter;
