import { AzureOpenAI } from "openai";
import { z } from "zod";
import { OpenAIAdapter } from "./openai_adapter";
export declare class AzureOpenAIAdapter extends OpenAIAdapter<AzureOpenAI> {
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string | undefined;
        apiModelAudioTranscription: string | undefined;
        apiModelText2Speech: string | undefined;
        endpoint: string | undefined;
        apiVersion: string | undefined;
    }, llmConfigSchema?: z.ZodObject<{
        apiKey: z.ZodString;
        apiModelChat: z.ZodString;
        apiModelAudioTranscription: z.ZodOptional<z.ZodString>;
        apiModelText2Speech: z.ZodOptional<z.ZodString>;
        endpoint: z.ZodString;
        apiVersion: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        apiKey: string;
        apiModelChat: string;
        endpoint: string;
        apiVersion: string;
        apiModelAudioTranscription?: string | undefined;
        apiModelText2Speech?: string | undefined;
    }, {
        apiKey: string;
        apiModelChat: string;
        endpoint: string;
        apiVersion: string;
        apiModelAudioTranscription?: string | undefined;
        apiModelText2Speech?: string | undefined;
    }>);
}
