import { Groq } from "groq-sdk";
import { LlmAdapter } from "./llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export declare class GroqAdapter implements LlmAdapter {
    protected llmConfig: {
        apiKey: any;
        apiModelChat: string;
    };
    protected groqClient: Groq;
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string;
    });
    private initCheck;
    private convertTools;
    chatCompletions(systemPrompt: string[], firstMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: Groq.Chat.ChatCompletionMessageParam[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(__: string, ___?: Record<string, any>): Promise<string>;
    textToSpeech(_: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
