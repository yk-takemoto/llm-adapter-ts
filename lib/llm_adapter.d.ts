import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export interface LlmAdapter {
    chatCompletions(systemPrompt: string[], firstMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: any[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(audioFilePath: string, options?: Record<string, any>): Promise<string>;
    textToSpeech(message: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
