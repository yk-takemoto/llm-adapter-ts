import { openAIAdapterBuilder } from "@/openai_adapter";
import anthropicAdapter from "@/anthropic_adapter";
import geminiAdapter from "@/gemini_adapter";
import groqAdapter from "@/groq_adapter";
import { LlmId, LlmAdapterBuilder, LlmAdapter, ChatCompletionsArguments, SpeechToTextArguments, TextToSpeechArguments } from "@/llm_adapter_schemas";
import { SupportedSorryAudioFormat, SORRY_AUDIO_BASE64 } from "@/sorry_audio_base64";

const getAdapter = (llmId: LlmId): LlmAdapter => {
  const llmAdapterMap: Record<LlmId, LlmAdapterBuilder | LlmAdapter> = {
    OpenAI: openAIAdapterBuilder,
    AzureOpenAI: openAIAdapterBuilder,
    Anthropic: anthropicAdapter,
    Google: geminiAdapter,
    Groq: groqAdapter,
  };

  const adapter = "build" in llmAdapterMap[llmId] ? llmAdapterMap[llmId].build({ args: llmId }) : llmAdapterMap[llmId];
  if (!adapter) {
    throw new Error(`[llmAdapterHelper] Adapter for ${llmId} is not available.`);
  }

  return adapter;
};

const llmAdapterHelper = (llmId: LlmId) => ({
  chatCompletions: async (args: ChatCompletionsArguments) => {
    const adapter = getAdapter(llmId);
    if (!("chatCompletions" in adapter) || !adapter.chatCompletions) {
      throw new Error(`[llmAdapterHelper#chatCompletions] Adapter for ${llmId} does not support chatCompletions.`);
    }

    return await adapter.chatCompletions({ args });
  },
  speechToText: async (args: SpeechToTextArguments) => {
    const adapter = getAdapter(llmId);
    const resUnSupported = "unsupported";

    return "speechToText" in adapter && !!adapter.speechToText ? await adapter.speechToText({ args }) : resUnSupported;
  },
  textToSpeech: async (args: TextToSpeechArguments) => {
    const adapter = getAdapter(llmId);
    const resUnSupported = (responseFormat: SupportedSorryAudioFormat = "mp3") => {
      const format = ["wav", "aac"].includes(responseFormat) ? responseFormat : "mp3";
      const contentType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
      if (!(format in SORRY_AUDIO_BASE64)) {
        const buffer = Buffer.from(SORRY_AUDIO_BASE64.mp3, "base64");
        return { contentType: "audio/mpeg", content: buffer };
      }

      const buffer = Buffer.from(SORRY_AUDIO_BASE64[format], "base64");
      return {
        contentType: contentType,
        content: buffer,
      };
    };

    return "textToSpeech" in adapter && !!adapter.textToSpeech ? await adapter.textToSpeech({ args }) : resUnSupported(args.options?.responseFormat);
  },
});

export default llmAdapterHelper;
