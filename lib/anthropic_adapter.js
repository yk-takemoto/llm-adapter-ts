"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.anthropicAdapterBuilder = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const zod_1 = require("zod");
const llm_adapter_schemas_1 = require("./llm_adapter_schemas");
const convertTools = (tools) => {
    return tools.map((tool) => {
        return {
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema,
        };
    });
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
        content: Array.isArray(message.content)
            ? message.content.map((item) => (item.type === "image" ? { ...item, source: { ...item.source, data: "ommitted" } } : item))
            : message.content,
    }));
};
const anthropicClientBuilderArgsSchema = zod_1.z
    .object({
    apiKey: zod_1.z.string().min(1, "ANTHROPIC_API_KEY is required"),
})
    .passthrough();
const anthropicClientBuilder = {
    build: ({ args = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    }, argsSchema = anthropicClientBuilderArgsSchema, } = {}) => {
        const parsedArgs = argsSchema.parse(args || {});
        return new sdk_1.default(parsedArgs);
    },
};
exports.anthropicAdapterBuilder = {
    build: ({ buildClientInputParams } = {}) => ({
        chatCompletions: async ({ args, argsSchema = llm_adapter_schemas_1.chatCompletionsArgsSchema, config = {
            apiModelChat: process.env.ANTHROPIC_API_MODEL_CHAT,
        }, configSchema = zod_1.z.object({
            apiModelChat: zod_1.z.string().min(1, "ANTHROPIC_API_MODEL_CHAT is required"),
        }), } = {}) => {
            const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
            const { apiModelChat } = configSchema.parse(config || {});
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
                        const { mimeType, base64Content } = await convertImageUrlToBase64(content.image.url);
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
                    tools: convertTools(options.tools),
                    tool_choice: { type: options.toolOption.choice || "auto" },
                }
                : {};
            const chatOtions = {
                model: apiModelChat,
                messages: updatedMessages,
                system: covertedSystemPrompt,
                max_tokens: options.toolOption.maxTokens || 1028,
                temperature: options.toolOption.temperature ?? 0.7,
                ...toolsOption,
            };
            let response;
            try {
                // For history
                const historyMessages = convertMessagesForHistory(updatedMessages);
                // debug
                console.log("[chatCompletions] start -- covertedSystemPrompt: ", JSON.stringify(covertedSystemPrompt), " -- historyMessages: ", JSON.stringify(historyMessages));
                const anthropicClient = anthropicClientBuilder.build(buildClientInputParams || {});
                const chatResponse = await anthropicClient.messages.create(chatOtions);
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
        },
    }),
};
