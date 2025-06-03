import { z } from "zod";
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
export type McpTool = z.infer<typeof mcpToolSchema>;
export declare const GeneralArgumentsSchema: z.ZodRecord<z.ZodString, z.ZodAny>;
type GeneralArguments = z.infer<typeof GeneralArgumentsSchema>;
export declare const GeneralResultSchema: z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodArray<z.ZodAny, "many">]>;
type GeneralResult = z.infer<typeof GeneralResultSchema>;
export declare const GeneralConfigSchema: z.ZodRecord<z.ZodString, z.ZodAny>;
type GeneralConfig = z.infer<typeof GeneralConfigSchema>;
type LlmAdapterInputParams<ArgumentsType = GeneralArguments, ConfigType = GeneralConfig> = {
    args?: ArgumentsType;
    argsSchema?: z.ZodType<ArgumentsType>;
    config?: ConfigType;
    configSchema?: z.ZodType<ConfigType>;
};
type LlmAdapterResult<ResultType = GeneralResult> = ResultType;
export type LlmAdapterFunction<ArgumentsType = GeneralArguments, ResultType = GeneralResult, ConfigType = GeneralConfig> = (params?: LlmAdapterInputParams<ArgumentsType, ConfigType>) => LlmAdapterResult<ResultType>;
export type LlmAdapterAsyncFunction<ArgumentsType = GeneralArguments, ResultType = GeneralResult, ConfigType = GeneralConfig> = (params?: LlmAdapterInputParams<ArgumentsType, ConfigType>) => Promise<LlmAdapterResult<ResultType>>;
export declare const chatCompletionsContentSchema: z.ZodObject<{
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
export type ChatCompletionsContent = z.infer<typeof chatCompletionsContentSchema>;
export declare const chatCompletionsOptionsSchema: z.ZodObject<{
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
}, "strip", z.ZodAny, z.objectOutputType<{
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
}, z.ZodAny, "strip">, z.objectInputType<{
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
}, z.ZodAny, "strip">>;
export type ChatCompletionsOptions = z.infer<typeof chatCompletionsOptionsSchema>;
export declare const chatCompletionsArgumentsSchema: z.ZodObject<{
    systemPrompt: z.ZodArray<z.ZodString, "many">;
    newMessageContents: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    options: z.ZodObject<{
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
    }, "strip", z.ZodAny, z.objectOutputType<{
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
    }, z.ZodAny, "strip">, z.objectInputType<{
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
    }, z.ZodAny, "strip">>;
    inProgress: z.ZodOptional<z.ZodObject<{
        messages: z.ZodArray<z.ZodAny, "many">;
        toolResults: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            content: string;
        }, {
            id: string;
            content: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        messages: any[];
        toolResults?: {
            id: string;
            content: string;
        }[] | undefined;
    }, {
        messages: any[];
        toolResults?: {
            id: string;
            content: string;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    options: {
        toolOption: {
            type?: "function" | "function_strict" | "response_format" | undefined;
            choice?: any;
            maxTokens?: number | undefined;
            temperature?: number | undefined;
        };
        tools?: any[] | undefined;
    } & {
        [k: string]: any;
    };
    systemPrompt: string[];
    newMessageContents: {
        text?: string | undefined;
        image?: {
            url: string;
            detail?: any;
        } | undefined;
        audio?: {
            data: string;
            format?: any;
        } | undefined;
    }[];
    inProgress?: {
        messages: any[];
        toolResults?: {
            id: string;
            content: string;
        }[] | undefined;
    } | undefined;
}, {
    options: {
        toolOption: {
            type?: "function" | "function_strict" | "response_format" | undefined;
            choice?: any;
            maxTokens?: number | undefined;
            temperature?: number | undefined;
        };
        tools?: any[] | undefined;
    } & {
        [k: string]: any;
    };
    systemPrompt: string[];
    newMessageContents: {
        text?: string | undefined;
        image?: {
            url: string;
            detail?: any;
        } | undefined;
        audio?: {
            data: string;
            format?: any;
        } | undefined;
    }[];
    inProgress?: {
        messages: any[];
        toolResults?: {
            id: string;
            content: string;
        }[] | undefined;
    } | undefined;
}>;
export type ChatCompletionsArguments = z.infer<typeof chatCompletionsArgumentsSchema>;
export declare const chatCompletionsResultSchema: z.ZodObject<{
    text: z.ZodNullable<z.ZodString>;
    tools: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        arguments: Record<string, any>;
    }, {
        name: string;
        id: string;
        arguments: Record<string, any>;
    }>, "many">;
    messages: z.ZodArray<z.ZodAny, "many">;
}, "strip", z.ZodTypeAny, {
    text: string | null;
    tools: {
        name: string;
        id: string;
        arguments: Record<string, any>;
    }[];
    messages: any[];
}, {
    text: string | null;
    tools: {
        name: string;
        id: string;
        arguments: Record<string, any>;
    }[];
    messages: any[];
}>;
export type ChatCompletionsResult = z.infer<typeof chatCompletionsResultSchema>;
export declare const speechToTextOptionsSchema: z.ZodObject<{
    language: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodAny, z.objectOutputType<{
    language: z.ZodOptional<z.ZodString>;
}, z.ZodAny, "strip">, z.objectInputType<{
    language: z.ZodOptional<z.ZodString>;
}, z.ZodAny, "strip">>;
export type SpeechToTextOptions = z.infer<typeof speechToTextOptionsSchema>;
export declare const speechToTextArgumentsSchema: z.ZodObject<{
    audioFilePath: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        language: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodAny, z.objectOutputType<{
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodAny, "strip">, z.objectInputType<{
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodAny, "strip">>>;
}, "strip", z.ZodTypeAny, {
    audioFilePath: string;
    options?: z.objectOutputType<{
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodAny, "strip"> | undefined;
}, {
    audioFilePath: string;
    options?: z.objectInputType<{
        language: z.ZodOptional<z.ZodString>;
    }, z.ZodAny, "strip"> | undefined;
}>;
export type SpeechToTextArguments = z.infer<typeof speechToTextArgumentsSchema>;
export declare const speechToTextResultSchema: z.ZodString;
export type SpeechToTextResult = z.infer<typeof speechToTextResultSchema>;
export declare const textToSpeechOptionsSchema: z.ZodObject<{
    voice: z.ZodAny;
    responseFormat: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodAny, z.objectOutputType<{
    voice: z.ZodAny;
    responseFormat: z.ZodOptional<z.ZodAny>;
}, z.ZodAny, "strip">, z.objectInputType<{
    voice: z.ZodAny;
    responseFormat: z.ZodOptional<z.ZodAny>;
}, z.ZodAny, "strip">>;
export type TextToSpeechOptions = z.infer<typeof textToSpeechOptionsSchema>;
export declare const textToSpeechArgumentsSchema: z.ZodObject<{
    message: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        voice: z.ZodAny;
        responseFormat: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodAny, z.objectOutputType<{
        voice: z.ZodAny;
        responseFormat: z.ZodOptional<z.ZodAny>;
    }, z.ZodAny, "strip">, z.objectInputType<{
        voice: z.ZodAny;
        responseFormat: z.ZodOptional<z.ZodAny>;
    }, z.ZodAny, "strip">>>;
}, "strip", z.ZodTypeAny, {
    message: string;
    options?: z.objectOutputType<{
        voice: z.ZodAny;
        responseFormat: z.ZodOptional<z.ZodAny>;
    }, z.ZodAny, "strip"> | undefined;
}, {
    message: string;
    options?: z.objectInputType<{
        voice: z.ZodAny;
        responseFormat: z.ZodOptional<z.ZodAny>;
    }, z.ZodAny, "strip"> | undefined;
}>;
export type TextToSpeechArguments = z.infer<typeof textToSpeechArgumentsSchema>;
export declare const textToSpeechResultSchema: z.ZodObject<{
    contentType: z.ZodString;
    content: z.ZodType<Buffer<ArrayBuffer>, z.ZodTypeDef, Buffer<ArrayBuffer>>;
}, "strip", z.ZodTypeAny, {
    content: Buffer<ArrayBuffer>;
    contentType: string;
}, {
    content: Buffer<ArrayBuffer>;
    contentType: string;
}>;
export type TextToSpeechResult = z.infer<typeof textToSpeechResultSchema>;
export type ChatCompletionsAdapter = {
    chatCompletions: LlmAdapterAsyncFunction<ChatCompletionsArguments, ChatCompletionsResult>;
};
export type SpeechToTextAdapter = {
    speechToText: LlmAdapterAsyncFunction<SpeechToTextArguments, SpeechToTextResult>;
};
export type TextToSpeechAdapter = {
    textToSpeech: LlmAdapterAsyncFunction<TextToSpeechArguments, TextToSpeechResult>;
};
export type LlmAdapter = ChatCompletionsAdapter & Partial<SpeechToTextAdapter & TextToSpeechAdapter>;
export declare const llmIdSchema: z.ZodEnum<["OpenAI", "AzureOpenAI", "Anthropic", "Google", "Groq"]>;
export type LlmId = z.infer<typeof llmIdSchema>;
export type LlmAdapterBuilder = {
    build: LlmAdapterFunction<LlmId, LlmAdapter>;
};
export type LlmClientBuilder<LlmClientType> = {
    build: LlmAdapterFunction<undefined, LlmClientType>;
};
export {};
