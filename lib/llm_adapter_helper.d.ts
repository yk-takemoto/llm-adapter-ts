import { LlmId, LlmAdapterInputParams, ChatCompletionsArgs, SpeechToTextArgs, TextToSpeechArgs } from "./llm_adapter_schemas";
type LlmAdapterHelperParams = {
    llmId: LlmId;
    buildClientInputParams?: LlmAdapterInputParams<any, Record<string, any>>;
};
declare const llmAdapterHelper: (helperParams: LlmAdapterHelperParams) => {
    chatCompletions: (params: LlmAdapterInputParams<ChatCompletionsArgs>) => Promise<{
        text: string | null;
        tools: {
            name: string;
            id: string;
            arguments: Record<string, any>;
        }[];
        messages: any[];
    }>;
    speechToText: (params: LlmAdapterInputParams<SpeechToTextArgs>) => Promise<string>;
    textToSpeech: (params: LlmAdapterInputParams<TextToSpeechArgs>) => Promise<{
        content: Buffer<ArrayBuffer>;
        contentType: string;
    }>;
};
export default llmAdapterHelper;
