import { z } from "zod";
export declare const llmChatCompletionsResponseSchema: z.ZodObject<{
    text: z.ZodNullable<z.ZodString>;
    tools: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        arguments: Record<string, any>;
    }, {
        id: string;
        name: string;
        arguments: Record<string, any>;
    }>, "many">;
    messages: z.ZodArray<z.ZodAny, "many">;
}, "strip", z.ZodTypeAny, {
    text: string | null;
    tools: {
        id: string;
        name: string;
        arguments: Record<string, any>;
    }[];
    messages: any[];
}, {
    text: string | null;
    tools: {
        id: string;
        name: string;
        arguments: Record<string, any>;
    }[];
    messages: any[];
}>;
export declare const llmChatCompletionsContentSchema: z.ZodObject<{
    text: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        detail: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        detail?: any;
    }, {
        url: string;
        detail?: any;
    }>>;
    audio: z.ZodOptional<z.ZodObject<{
        data: z.ZodString;
        format: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        data: string;
        format?: any;
    }, {
        data: string;
        format?: any;
    }>>;
}, "strip", z.ZodTypeAny, {
    text?: string | undefined;
    image?: {
        url: string;
        detail?: any;
    } | undefined;
    audio?: {
        data: string;
        format?: any;
    } | undefined;
}, {
    text?: string | undefined;
    image?: {
        url: string;
        detail?: any;
    } | undefined;
    audio?: {
        data: string;
        format?: any;
    } | undefined;
}>;
export declare const llmChatCompletionsOptionsSchema: z.ZodObject<{
    tools: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    toolOption: z.ZodObject<{
        choice: z.ZodOptional<z.ZodAny>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
        type: z.ZodOptional<z.ZodEnum<["function", "function_strict", "response_format"]>>;
    }, "strip", z.ZodTypeAny, {
        type?: "function" | "function_strict" | "response_format" | undefined;
        choice?: any;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
    }, {
        type?: "function" | "function_strict" | "response_format" | undefined;
        choice?: any;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    toolOption: {
        type?: "function" | "function_strict" | "response_format" | undefined;
        choice?: any;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
    };
    tools?: any[] | undefined;
}, {
    toolOption: {
        type?: "function" | "function_strict" | "response_format" | undefined;
        choice?: any;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
    };
    tools?: any[] | undefined;
}>;
export declare const llmTextToSpeechResponseSchema: z.ZodObject<{
    contentType: z.ZodString;
    content: z.ZodType<Buffer<ArrayBuffer>, z.ZodTypeDef, Buffer<ArrayBuffer>>;
}, "strip", z.ZodTypeAny, {
    contentType: string;
    content: Buffer<ArrayBuffer>;
}, {
    contentType: string;
    content: Buffer<ArrayBuffer>;
}>;
export declare const mcpToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    inputSchema: z.ZodObject<{
        type: z.ZodString;
        properties: z.ZodRecord<z.ZodString, z.ZodAny>;
        required: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: string;
        properties: Record<string, any>;
        required: string[];
    }, {
        type: string;
        properties: Record<string, any>;
        required: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
}, {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
}>;
export type LlmChatCompletionsResponse = z.infer<typeof llmChatCompletionsResponseSchema>;
export type LlmChatCompletionsContent = z.infer<typeof llmChatCompletionsContentSchema>;
export type LlmChatCompletionsOptions = z.infer<typeof llmChatCompletionsOptionsSchema>;
export type LlmTextToSpeechResponse = z.infer<typeof llmTextToSpeechResponseSchema>;
export type McpTool = z.infer<typeof mcpToolSchema>;
