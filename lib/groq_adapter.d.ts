import { Groq } from "groq-sdk";
import { z } from "zod";
import { LlmAdapter } from "./llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export declare class GroqAdapter implements LlmAdapter {
    protected llmConfig: {
        apiKey: string;
        apiModelChat: string;
    };
    protected groqClient: Groq;
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string | undefined;
    }, llmConfigSchema?: z.ZodObject<{
        apiKey: z.ZodString;
        apiModelChat: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        apiKey: string;
        apiModelChat: string;
    }, {
        apiKey: string;
        apiModelChat: string;
    }>);
    private convertTools;
    chatCompletions(systemPrompt: string[], newMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: Groq.Chat.ChatCompletionMessageParam[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(__: string, ___?: Record<string, any>): Promise<string>;
    textToSpeech(_: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
