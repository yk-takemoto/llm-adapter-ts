"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.amazonBedrockAdapterBuilder = void 0;
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const zod_1 = require("zod");
const llm_adapter_schemas_1 = require("./llm_adapter_schemas");
const convertTools = (tools) => {
    return tools.map((tool) => {
        return {
            toolSpec: {
                name: tool.name,
                description: tool.description,
                inputSchema: {
                    json: tool.inputSchema,
                },
            },
        };
    });
};
const resolveImageFormat = (mimeType) => {
    if (mimeType.includes("png"))
        return "png";
    if (mimeType.includes("gif"))
        return "gif";
    if (mimeType.includes("webp"))
        return "webp";
    return "jpeg";
};
const convertImageUrlToBytes = async (imageUrl) => {
    try {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = response.headers.get("content-type") || "image/jpeg";
        const format = resolveImageFormat(mimeType);
        return { format, bytes: new Uint8Array(buffer) };
    }
    catch (error) {
        throw new Error(`Failed to fetch or convert image: ${error}`);
    }
};
const convertMessagesForHistory = (messages) => {
    return messages.map((message) => ({
        ...message,
        content: Array.isArray(message.content)
            ? message.content.map((item) => {
                if (item.image?.source?.bytes) {
                    return {
                        ...item,
                        image: {
                            ...item.image,
                            source: {
                                ...item.image.source,
                                bytes: "ommitted",
                            },
                        },
                    };
                }
                return item;
            })
            : message.content,
    }));
};
const amazonBedrockClientBuilderArgsSchema = zod_1.z
    .object({
    region: zod_1.z.string().min(1, "AWS_REGION or AMAZON_BEDROCK_REGION is required"),
    accessKeyId: zod_1.z.string().optional(),
    secretAccessKey: zod_1.z.string().optional(),
    sessionToken: zod_1.z.string().optional(),
    endpoint: zod_1.z.string().optional(),
})
    .passthrough();
const amazonBedrockClientBuilder = {
    build: ({ args = {
        region: process.env.AWS_REGION || process.env.AMAZON_BEDROCK_REGION,
        accessKeyId: JSON.parse(process.env.APP_SECRETS || "{}").AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: JSON.parse(process.env.APP_SECRETS || "{}").AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: JSON.parse(process.env.APP_SECRETS || "{}").AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN,
        endpoint: process.env.AMAZON_BEDROCK_ENDPOINT,
    }, argsSchema = amazonBedrockClientBuilderArgsSchema, } = {}) => {
        const parsedArgs = argsSchema.parse(args || {});
        const credentials = parsedArgs.accessKeyId && parsedArgs.secretAccessKey
            ? {
                accessKeyId: parsedArgs.accessKeyId,
                secretAccessKey: parsedArgs.secretAccessKey,
                sessionToken: parsedArgs.sessionToken,
            }
            : undefined;
        return new client_bedrock_runtime_1.BedrockRuntimeClient({
            region: parsedArgs.region,
            credentials,
            endpoint: parsedArgs.endpoint,
        });
    },
};
const buildToolChoice = (choice) => {
    if (!choice || choice === "auto") {
        return { auto: {} };
    }
    if (choice === "any") {
        return { any: {} };
    }
    if (typeof choice === "string") {
        return { tool: { name: choice } };
    }
    return choice;
};
exports.amazonBedrockAdapterBuilder = {
    build: ({ buildClientInputParams } = {}) => ({
        chatCompletions: async ({ args, argsSchema = llm_adapter_schemas_1.chatCompletionsArgsSchema, config = {
            apiModelChat: process.env.AMAZON_BEDROCK_API_MODEL_CHAT,
        }, configSchema = zod_1.z.object({
            apiModelChat: zod_1.z.string().min(1, "AMAZON_BEDROCK_API_MODEL_CHAT is required"),
        }), } = {}) => {
            const { systemPrompt, newMessageContents, options, inProgress } = argsSchema.parse(args);
            const { apiModelChat } = configSchema.parse(config || {});
            let updatedMessages = [];
            if (inProgress) {
                const resMessages = inProgress.toolResults?.map((toolResult) => {
                    return {
                        role: "user",
                        content: [
                            {
                                toolResult: {
                                    toolUseId: toolResult.id,
                                    content: [{ text: toolResult.content }],
                                },
                            },
                        ],
                    };
                }) || [];
                updatedMessages = inProgress.messages.concat(resMessages);
            }
            if (newMessageContents.length > 0) {
                const contentBlocks = await Promise.all(newMessageContents.map(async (content) => {
                    if (content.image) {
                        const { format, bytes } = await convertImageUrlToBytes(content.image.url);
                        return {
                            image: {
                                format,
                                source: {
                                    bytes,
                                },
                            },
                        };
                    }
                    return {
                        text: content.text || "",
                    };
                }));
                updatedMessages.push({
                    role: "user",
                    content: contentBlocks,
                });
            }
            const toolsOption = options.tools && options.tools.length > 0
                ? {
                    toolConfig: {
                        tools: convertTools(options.tools),
                        toolChoice: buildToolChoice(options.toolOption.choice),
                    },
                }
                : {};
            const chatOptions = {
                modelId: apiModelChat,
                messages: updatedMessages,
                system: systemPrompt.map((msg) => ({ text: msg })),
                inferenceConfig: {
                    maxTokens: options.toolOption.maxTokens || 1028,
                    temperature: options.toolOption.temperature ?? 0.7,
                },
                ...toolsOption,
            };
            let response;
            try {
                // For history
                const historyMessages = convertMessagesForHistory(updatedMessages);
                // debug
                console.log("[chatCompletions] start -- systemPrompt: ", JSON.stringify(systemPrompt), " -- historyMessages: ", JSON.stringify(historyMessages));
                const bedrockClient = amazonBedrockClientBuilder.build(buildClientInputParams || {});
                const chatResponse = await bedrockClient.send(new client_bedrock_runtime_1.ConverseCommand(chatOptions));
                const message = chatResponse.output?.message;
                const stopReason = chatResponse.stopReason;
                // debug
                console.log(`[chatCompletions] end -- message: ${JSON.stringify(message)} stopReason: ${stopReason}`);
                const contents = message?.content || [];
                let resTools = [];
                if (message) {
                    updatedMessages.push(message);
                    resTools =
                        contents
                            ?.filter((contentBlock) => contentBlock.toolUse)
                            .map((contentBlock) => {
                            const toolUse = contentBlock.toolUse || {};
                            return {
                                id: toolUse.toolUseId || toolUse.id || "",
                                name: toolUse.name || "",
                                arguments: (toolUse.input || {}),
                            };
                        }) || [];
                }
                const textBlock = contents.find((contentBlock) => typeof contentBlock.text === "string");
                const text = textBlock?.text ?? null;
                response = {
                    text: resTools.length > 0 && options.toolOption.type === "response_format" ? JSON.stringify(resTools[0].arguments) : text,
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
    }),
};
