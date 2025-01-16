import { AzureOpenAI } from "openai";
import { OpenAIAdapter } from "./openai_adapter";
export declare class AzureOpenAIAdapter extends OpenAIAdapter<AzureOpenAI> {
    constructor(llmConfig?: {
        apiKey: any;
        apiModelChat: string;
        apiModelAudioTranscription: string;
        apiModelText2Speech: string;
        endpoint: string;
        apiVersion: string;
    });
}
