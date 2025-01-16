import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { LlmAdapter } from "./llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export declare class GeminiAdapter implements LlmAdapter {
    protected llmConfig: {
        apiKey: any;
        apiModelChat: string;
    };
    protected geminiClient: GoogleGenerativeAI;
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string;
    });
    private initCheck;
    private convertTools;
    private convertResponseFormatJSONSchema;
    private convertImageUrlToBase64;
    private convertMessagesForHistory;
    chatCompletions(systemPrompt: string[], firstMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: Content[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(__: string, ___?: Record<string, any>): Promise<string>;
    textToSpeech(_: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
