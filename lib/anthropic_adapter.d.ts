import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { LlmAdapter } from "./llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export declare class AnthropicAdapter implements LlmAdapter {
    protected llmConfig: {
        apiKey: string;
        apiModelChat: string;
    };
    protected anthropicClient: Anthropic;
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
    private convertImageUrlToBase64;
    private convertMessagesForHistory;
    chatCompletions(systemPrompt: string[], newMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: Anthropic.MessageParam[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(__: string, ___?: Record<string, any>): Promise<string>;
    textToSpeech(_: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
