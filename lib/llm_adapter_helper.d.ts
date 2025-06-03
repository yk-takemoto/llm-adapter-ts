import { LlmId, ChatCompletionsArguments, SpeechToTextArguments, TextToSpeechArguments } from "./llm_adapter_schemas";
declare const llmAdapterHelper: (params: {
    llmId: LlmId;
}) => {
    chatCompletions: (args: ChatCompletionsArguments) => Promise<{
        text: string | null;
        tools: {
            name: string;
            id: string;
            arguments: Record<string, any>;
        }[];
        messages: any[];
    }>;
    speechToText: (args: SpeechToTextArguments) => Promise<string>;
    textToSpeech: (args: TextToSpeechArguments) => Promise<{
        content: Buffer<ArrayBuffer>;
        contentType: string;
    }>;
};
export default llmAdapterHelper;
