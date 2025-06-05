"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmIdSchema = exports.textToSpeechResultSchema = exports.textToSpeechArgsSchema = exports.textToSpeechOptionsSchema = exports.speechToTextResultSchema = exports.speechToTextArgsSchema = exports.speechToTextOptionsSchema = exports.chatCompletionsResultSchema = exports.chatCompletionsArgsSchema = exports.chatCompletionsOptionsSchema = exports.chatCompletionsContentSchema = exports.generalConfigSchema = exports.generalResultSchema = exports.generalArgumentsSchema = exports.mcpToolSchema = void 0;
const zod_1 = require("zod");
exports.mcpToolSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    inputSchema: zod_1.z.object({
        type: zod_1.z.string(),
        properties: zod_1.z.record(zod_1.z.any()),
        required: zod_1.z.array(zod_1.z.string()),
    }),
});
exports.generalArgumentsSchema = zod_1.z.record(zod_1.z.any());
exports.generalResultSchema = zod_1.z.union([zod_1.z.record(zod_1.z.any()), zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean(), zod_1.z.array(zod_1.z.any())]);
exports.generalConfigSchema = zod_1.z.record(zod_1.z.any());
exports.chatCompletionsContentSchema = zod_1.z.object({
    text: zod_1.z.string().optional(),
    image: zod_1.z
        .object({
        url: zod_1.z.string(),
        detail: zod_1.z.any().optional(),
    })
        .optional(),
    audio: zod_1.z
        .object({
        data: zod_1.z.string(),
        format: zod_1.z.any().optional(),
    })
        .optional(),
});
exports.chatCompletionsOptionsSchema = zod_1.z
    .object({
    tools: zod_1.z.array(zod_1.z.any()).optional(),
    toolOption: zod_1.z.object({
        choice: zod_1.z.any().optional(),
        maxTokens: zod_1.z.number().optional(),
        temperature: zod_1.z.number().optional(),
        type: zod_1.z.enum(["function", "function_strict", "response_format"]).optional(),
    }),
})
    .catchall(zod_1.z.any());
exports.chatCompletionsArgsSchema = zod_1.z.object({
    systemPrompt: zod_1.z.array(zod_1.z.string()),
    newMessageContents: zod_1.z.array(exports.chatCompletionsContentSchema),
    options: exports.chatCompletionsOptionsSchema,
    inProgress: zod_1.z
        .object({
        messages: zod_1.z.array(zod_1.z.any()),
        toolResults: zod_1.z
            .array(zod_1.z.object({
            id: zod_1.z.string(),
            content: zod_1.z.string(),
        }))
            .optional(),
    })
        .optional(),
});
exports.chatCompletionsResultSchema = zod_1.z.object({
    text: zod_1.z.string().nullable(),
    tools: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        arguments: zod_1.z.record(zod_1.z.any()),
    })),
    messages: zod_1.z.array(zod_1.z.any()),
});
exports.speechToTextOptionsSchema = zod_1.z
    .object({
    language: zod_1.z.string().optional(),
})
    .catchall(zod_1.z.any());
exports.speechToTextArgsSchema = zod_1.z.object({
    audioFilePath: zod_1.z.string(),
    options: exports.speechToTextOptionsSchema.optional(),
});
exports.speechToTextResultSchema = zod_1.z.string();
exports.textToSpeechOptionsSchema = zod_1.z
    .object({
    voice: zod_1.z.any(),
    responseFormat: zod_1.z.any().optional(),
})
    .catchall(zod_1.z.any());
exports.textToSpeechArgsSchema = zod_1.z.object({
    message: zod_1.z.string(),
    options: exports.textToSpeechOptionsSchema.optional(),
});
exports.textToSpeechResultSchema = zod_1.z.object({
    contentType: zod_1.z.string(),
    content: zod_1.z.instanceof(Buffer),
});
exports.llmIdSchema = zod_1.z.enum(["OpenAI", "AzureOpenAI", "Anthropic", "Google", "Groq"]);
