import { openAIAdapterBuilder } from "@/openai_adapter";
import { anthropicAdapterBuilder } from "@/anthropic_adapter";
import { geminiAdapterBuilder } from "@/gemini_adapter";
import { groqAdapterBuilder } from "@/groq_adapter";
import { LlmId, LlmAdapterInputParams, LlmAdapterBuilder, LlmAdapter, ChatCompletionsArgs, SpeechToTextArgs, TextToSpeechArgs } from "@/llm_adapter_schemas";
import { SupportedSorryAudioFormat, SORRY_AUDIO_BASE64 } from "@/sorry_audio_base64";

type LlmAdapterHelperParams = {
  llmId: LlmId;
  buildClientInputParams?: LlmAdapterInputParams<any, Record<string, any>>;
};

const getAdapter = (params: LlmAdapterHelperParams): LlmAdapter => {
  const llmAdapterMap: Record<LlmId, LlmAdapterBuilder<any>> = {
    OpenAI: openAIAdapterBuilder,
    AzureOpenAI: openAIAdapterBuilder,
    Anthropic: anthropicAdapterBuilder,
    Google: geminiAdapterBuilder,
    Groq: groqAdapterBuilder,
  };

  const adapter = llmAdapterMap[params.llmId].build({ buildArgs: params.llmId, buildClientInputParams: params.buildClientInputParams });
  if (!adapter) {
    throw new Error(`[llmAdapterHelper] Adapter for ${params.llmId} is not available.`);
  }

  return adapter;
};

const llmAdapterHelper = (helperParams: LlmAdapterHelperParams) => ({
  chatCompletions: async (params: LlmAdapterInputParams<ChatCompletionsArgs>) => {
    const adapter = getAdapter(helperParams);
    if (!("chatCompletions" in adapter) || !adapter.chatCompletions) {
      throw new Error(`[llmAdapterHelper#chatCompletions] Adapter for ${helperParams.llmId} does not support chatCompletions.`);
    }

    return await adapter.chatCompletions(params);
  },
  speechToText: async (params: LlmAdapterInputParams<SpeechToTextArgs>) => {
    const adapter = getAdapter(helperParams);
    const resUnSupported = "unsupported";

    return "speechToText" in adapter && !!adapter.speechToText ? await adapter.speechToText(params) : resUnSupported;
  },
  textToSpeech: async (params: LlmAdapterInputParams<TextToSpeechArgs>) => {
    const adapter = getAdapter(helperParams);
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

    return "textToSpeech" in adapter && !!adapter.textToSpeech ? await adapter.textToSpeech(params) : resUnSupported(params.args?.options?.responseFormat);
  },
});

export default llmAdapterHelper;
