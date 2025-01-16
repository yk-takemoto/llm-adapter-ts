"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpToolSchema = exports.llmTextToSpeechResponseSchema = exports.llmChatCompletionsOptionsSchema = exports.llmChatCompletionsContentSchema = exports.llmChatCompletionsResponseSchema = void 0;
const zod_1 = require("zod");
exports.llmChatCompletionsResponseSchema = zod_1.z.object({
    text: zod_1.z.string().nullable(),
    tools: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        arguments: zod_1.z.record(zod_1.z.any()),
    })),
    messages: zod_1.z.array(zod_1.z.any()),
});
exports.llmChatCompletionsContentSchema = zod_1.z.object({
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
exports.llmChatCompletionsOptionsSchema = zod_1.z
    .object({
    tools: zod_1.z.array(zod_1.z.any()).optional(),
    toolChoice: zod_1.z.any().optional(),
    purposeOfTools: zod_1.z.enum(["function", "response_format"]).optional(),
})
    .catchall(zod_1.z.any());
exports.llmTextToSpeechResponseSchema = zod_1.z.object({
    contentType: zod_1.z.string(),
    content: zod_1.z.instanceof(Buffer),
});
exports.mcpToolSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    inputSchema: zod_1.z.object({
        type: zod_1.z.string(),
        properties: zod_1.z.record(zod_1.z.any()),
        required: zod_1.z.array(zod_1.z.string()),
    }),
});
