import OpenAI, { AzureOpenAI } from 'openai';
import { createReadStream, promises } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, FunctionCallingMode, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Groq } from 'groq-sdk';
import { z } from 'zod';

class OpenAIAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").OPENAI_API_KEY || process.env.OPENAI_API_KEY || "",
        apiModelChat: process.env.OPENAI_API_MODEL_CHAT,
        apiModelAudioTranscription: process.env.OPENAI_API_MODEL_AUDIO_TRANSCRIPTION,
        apiModelText2Speech: process.env.OPENAI_API_MODEL_TEXT2SPEECH,
    }, apiClient) {
        this.llmConfig = llmConfig;
        this.initCheck(llmConfig);
        this.openaiClient = apiClient || new OpenAI({ apiKey: llmConfig.apiKey });
    }
    initCheck(llmConfig) {
        for (const key of Object.keys(this.llmConfig)) {
            if (!llmConfig[key]) {
                throw new Error(`llmConfig.${key} is required but not set.`);
            }
        }
    }
    addAdditionalPropertiesElementToObjectType(schema, bool = false) {
        if (typeof schema !== "object" || schema === null) {
            return schema;
        }
        if (schema.type === "object") {
            schema.additionalProperties = bool;
            if (schema.properties) {
                for (const key in schema.properties) {
                    schema.properties[key] = this.addAdditionalPropertiesElementToObjectType(schema.properties[key], bool);
                }
            }
        }
        if (schema.type === "array" && schema.items) {
            schema.items = this.addAdditionalPropertiesElementToObjectType(schema.items, bool);
        }
        return schema;
    }
    convertTools(tools, isStrict) {
        const strict = isStrict
            ? {
                strict: isStrict,
            }
            : {};
        return tools.map((tool) => {
            return {
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    ...strict,
                    parameters: isStrict ? this.addAdditionalPropertiesElementToObjectType(tool.inputSchema, !isStrict) : tool.inputSchema,
                },
            };
        });
    }
    convertResponseFormatJSONSchema(tool) {
        return {
            type: "json_schema",
            json_schema: {
                name: tool.name,
                description: tool.description,
                strict: true,
                schema: this.addAdditionalPropertiesElementToObjectType(tool.inputSchema, false),
            },
        };
    }
    async chatCompletions(systemPrompt, firstMessageContents, options, inProgress) {
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
            systemPrompt.forEach((msg) => {
                updatedMessages.push({
                    role: "system",
                    content: msg,
                });
            });
            updatedMessages.push({
                role: "user",
                content: firstMessageContents.map((content) => {
                    return content.image
                        ? {
                            type: "image_url",
                            image_url: {
                                url: content.image.url,
                                detail: content.image.detail || "auto",
                            },
                        }
                        : content.audio
                            ? {
                                type: "input_audio",
                                input_audio: {
                                    data: content.audio.data,
                                    format: content.audio.format || "mp3",
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
                options.purposeOfTools === "function"
                    ? {
                        tools: this.convertTools(options.tools, true),
                        tool_choice: options.toolChoice || "auto",
                    }
                    : {};
            resFormatOption =
                options.purposeOfTools === "response_format"
                    ? {
                        response_format: this.convertResponseFormatJSONSchema(options.tools[0]),
                    }
                    : {};
        }
        const chatOtions = {
            model: this.llmConfig.apiModelChat,
            messages: updatedMessages,
            max_tokens: options.maxTokens || 1028,
            temperature: options.temperature ?? 0.7,
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
            const chatResponse = await this.openaiClient.chat.completions.create(chatOtions);
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
    async speechToText(audioFilePath, options) {
        const speechOtions = {
            file: createReadStream(audioFilePath),
            model: this.llmConfig.apiModelAudioTranscription,
            language: options?.language || "ja",
        };
        try {
            const response = await this.openaiClient.audio.transcriptions.create(speechOtions);
            return response.text;
        }
        catch (error) {
            // debug
            console.log("[speechToText] Error: ", error);
            throw error;
        }
    }
    async textToSpeech(message, options) {
        const speechOtions = {
            model: this.llmConfig.apiModelText2Speech || "tts-1",
            input: message,
            voice: options?.voice || "alloy",
            response_format: options?.responseFormat || "mp3",
        };
        try {
            const response = await this.openaiClient.audio.speech.create(speechOtions);
            const contentType = response.headers.get("content-type");
            const arrayBuffer = await response.arrayBuffer();
            return {
                contentType: contentType,
                content: Buffer.from(arrayBuffer),
            };
        }
        catch (error) {
            // debug
            console.log("[textToSpeech] Error: ", error);
            throw error;
        }
    }
}

class AzureOpenAIAdapter extends OpenAIAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY || "",
        apiModelChat: process.env.AZURE_OPENAI_API_DEPLOYMENT_CHAT,
        apiModelAudioTranscription: process.env.AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION,
        apiModelText2Speech: process.env.AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION,
    }) {
        const apiClient = new AzureOpenAI({ apiKey: llmConfig.apiKey, endpoint: llmConfig.endpoint, apiVersion: llmConfig.apiVersion });
        super(llmConfig, apiClient);
    }
}

class AnthropicAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
        apiModelChat: process.env.ANTHROPIC_API_MODEL_CHAT,
    }) {
        this.llmConfig = llmConfig;
        this.initCheck(llmConfig);
        this.anthropicClient = new Anthropic({ apiKey: llmConfig.apiKey });
    }
    initCheck(llmConfig) {
        for (const key of Object.keys(this.llmConfig)) {
            if (!llmConfig[key]) {
                throw new Error(`llmConfig.${key} is required but not set.`);
            }
        }
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
    async chatCompletions(systemPrompt, firstMessageContents, options, inProgress) {
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
        else {
            const list = await Promise.all(firstMessageContents.map(async (content) => {
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
                tool_choice: { type: options.toolChoice || "auto" },
            }
            : {};
        const chatOtions = {
            model: this.llmConfig.apiModelChat,
            messages: updatedMessages,
            system: covertedSystemPrompt,
            max_tokens: options.maxTokens || 1028,
            temperature: options.temperature ?? 0.7,
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
                text: resTools.length > 0 && options.purposeOfTools === "response_format"
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
            const sorry = await promises.readFile(`audio/sorry.ja.${sorryFormat}`);
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

class GeminiAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
        apiModelChat: process.env.GEMINI_API_MODEL_CHAT,
    }) {
        this.llmConfig = llmConfig;
        this.initCheck(llmConfig);
        this.geminiClient = new GoogleGenerativeAI(llmConfig.apiKey);
    }
    initCheck(llmConfig) {
        for (const key of Object.keys(this.llmConfig)) {
            if (!llmConfig[key]) {
                throw new Error(`llmConfig.${key} is required but not set.`);
            }
        }
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
                                mode: String(options.toolChoice).toUpperCase() || FunctionCallingMode.AUTO,
                            },
                        },
                    }
                    : {};
            resFormatOption = options.purposeOfTools === "response_format" ? this.convertResponseFormatJSONSchema(options.tools[0]) : {};
        }
        const modelParams = {
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
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
            const sorry = await promises.readFile(`audio/sorry.ja.${sorryFormat}`);
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

class GroqAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").GROQ_API_KEY || process.env.GROQ_API_KEY || "",
        apiModelChat: process.env.GROQ_API_MODEL_CHAT,
    }) {
        this.llmConfig = llmConfig;
        this.initCheck(llmConfig);
        this.groqClient = new Groq({ apiKey: llmConfig.apiKey });
    }
    initCheck(llmConfig) {
        for (const key of Object.keys(this.llmConfig)) {
            if (!llmConfig[key]) {
                throw new Error(`llmConfig.${key} is required but not set.`);
            }
        }
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
    async chatCompletions(systemPrompt, firstMessageContents, options, inProgress) {
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
            const hasImage = firstMessageContents.some((content) => content.image);
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
            updatedMessages.push({
                role: "user",
                content: firstMessageContents.map((content) => {
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
                options.purposeOfTools === "function"
                    ? {
                        tools: this.convertTools(options.tools),
                        tool_choice: options.toolChoice || "auto",
                    }
                    : {};
            resFormatOption =
                options.purposeOfTools === "response_format"
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
            max_tokens: options.maxTokens || 1028,
            temperature: options.temperature ?? 0.7,
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
            const sorry = await promises.readFile(`audio/sorry.ja.${sorryFormat}`);
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

const llmAdapterClasses = {
    OpenAI: OpenAIAdapter,
    AzureOpenAI: AzureOpenAIAdapter,
    Anthropic: AnthropicAdapter,
    Google: GeminiAdapter,
    Groq: GroqAdapter,
};
const llmAdapterBuilder = (llmId) => {
    const llmAdapterClass = llmAdapterClasses[llmId];
    return new llmAdapterClass();
};

const llmChatCompletionsResponseSchema = z.object({
    text: z.string().nullable(),
    tools: z.array(z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.record(z.any()),
    })),
    messages: z.array(z.any()),
});
const llmChatCompletionsContentSchema = z.object({
    text: z.string().optional(),
    image: z
        .object({
        url: z.string(),
        detail: z.any().optional(),
    })
        .optional(),
    audio: z
        .object({
        data: z.string(),
        format: z.any().optional(),
    })
        .optional(),
});
const llmChatCompletionsOptionsSchema = z
    .object({
    tools: z.array(z.any()).optional(),
    toolChoice: z.any().optional(),
    purposeOfTools: z.enum(["function", "response_format"]).optional(),
})
    .catchall(z.any());
const llmTextToSpeechResponseSchema = z.object({
    contentType: z.string(),
    content: z.instanceof(Buffer),
});
const mcpToolSchema = z.object({
    name: z.string(),
    description: z.string(),
    inputSchema: z.object({
        type: z.string(),
        properties: z.record(z.any()),
        required: z.array(z.string()),
    }),
});

var llm_adapter_schemas = /*#__PURE__*/Object.freeze({
    __proto__: null,
    llmChatCompletionsContentSchema: llmChatCompletionsContentSchema,
    llmChatCompletionsOptionsSchema: llmChatCompletionsOptionsSchema,
    llmChatCompletionsResponseSchema: llmChatCompletionsResponseSchema,
    llmTextToSpeechResponseSchema: llmTextToSpeechResponseSchema,
    mcpToolSchema: mcpToolSchema
});

export { llm_adapter_schemas as LlmAdapterSchemas, llmAdapterBuilder };
//# sourceMappingURL=bundle.esm.js.map
