import OpenAI from "openai";
import { LlmAdapter } from "./llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export declare class OpenAIAdapter<T extends OpenAI> implements LlmAdapter {
    protected llmConfig: {
        apiKey: any;
        apiModelChat: string;
        apiModelAudioTranscription: string;
        apiModelText2Speech: string;
    };
    protected openaiClient: OpenAI;
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string;
        apiModelAudioTranscription: string;
        apiModelText2Speech: string;
    }, apiClient?: T);
    private initCheck;
    private addAdditionalPropertiesElementToObjectType;
    private convertTools;
    private convertResponseFormatJSONSchema;
    chatCompletions(systemPrompt: string[], firstMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: OpenAI.ChatCompletionMessageParam[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(audioFilePath: string, options?: Record<string, any>): Promise<string>;
    textToSpeech(message: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
