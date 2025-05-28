import OpenAI from "openai";
import { z } from "zod";
import { LlmAdapter } from "./llm_adapter";
import { LlmChatCompletionsContent, LlmChatCompletionsOptions, LlmChatCompletionsResponse, LlmTextToSpeechResponse } from "./llm_adapter_schemas";
export declare class OpenAIAdapter<T extends OpenAI> implements LlmAdapter {
    protected llmConfig: {
        apiKey: string;
        apiModelChat: string;
        apiModelAudioTranscription?: string | undefined;
        apiModelText2Speech?: string | undefined;
    };
    protected openaiClient: OpenAI;
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string | undefined;
        apiModelAudioTranscription: string | undefined;
        apiModelText2Speech: string | undefined;
    }, llmConfigSchema?: z.ZodObject<{
        apiKey: z.ZodString;
        apiModelChat: z.ZodString;
        apiModelAudioTranscription: z.ZodOptional<z.ZodString>;
        apiModelText2Speech: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        apiKey: string;
        apiModelChat: string;
        apiModelAudioTranscription?: string | undefined;
        apiModelText2Speech?: string | undefined;
    }, {
        apiKey: string;
        apiModelChat: string;
        apiModelAudioTranscription?: string | undefined;
        apiModelText2Speech?: string | undefined;
    }>, apiClient?: T);
    private addAdditionalPropertiesElementToObjectType;
    private convertTools;
    private convertResponseFormatJSONSchema;
    chatCompletions(systemPrompt: string[], newMessageContents: LlmChatCompletionsContent[], options: LlmChatCompletionsOptions, inProgress?: {
        messages: OpenAI.ChatCompletionMessageParam[];
        toolResults?: {
            id: string;
            content: string;
        }[];
    }): Promise<LlmChatCompletionsResponse>;
    speechToText(audioFilePath: string, options?: Record<string, any>): Promise<string>;
    textToSpeech(message: string, options?: Record<string, any>): Promise<LlmTextToSpeechResponse>;
}
