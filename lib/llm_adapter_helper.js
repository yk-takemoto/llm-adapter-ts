"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const openai_adapter_1 = require("./openai_adapter");
const anthropic_adapter_1 = require("./anthropic_adapter");
const gemini_adapter_1 = require("./gemini_adapter");
const groq_adapter_1 = require("./groq_adapter");
const sorry_audio_base64_1 = require("./sorry_audio_base64");
const getAdapter = (params) => {
    const llmAdapterMap = {
        OpenAI: openai_adapter_1.openAIAdapterBuilder,
        AzureOpenAI: openai_adapter_1.openAIAdapterBuilder,
        Anthropic: anthropic_adapter_1.anthropicAdapterBuilder,
        Google: gemini_adapter_1.geminiAdapterBuilder,
        Groq: groq_adapter_1.groqAdapterBuilder,
    };
    const adapter = llmAdapterMap[params.llmId].build({ buildArgs: params.llmId, buildClientInputParams: params.buildClientInputParams });
    if (!adapter) {
        throw new Error(`[llmAdapterHelper] Adapter for ${params.llmId} is not available.`);
    }
    return adapter;
};
const llmAdapterHelper = (helperParams) => ({
    chatCompletions: async (params) => {
        const adapter = getAdapter(helperParams);
        if (!("chatCompletions" in adapter) || !adapter.chatCompletions) {
            throw new Error(`[llmAdapterHelper#chatCompletions] Adapter for ${helperParams.llmId} does not support chatCompletions.`);
        }
        return await adapter.chatCompletions(params);
    },
    speechToText: async (params) => {
        const adapter = getAdapter(helperParams);
        const resUnSupported = "unsupported";
        return "speechToText" in adapter && !!adapter.speechToText ? await adapter.speechToText(params) : resUnSupported;
    },
    textToSpeech: async (params) => {
        const adapter = getAdapter(helperParams);
        const resUnSupported = (responseFormat = "mp3") => {
            const format = ["wav", "aac"].includes(responseFormat) ? responseFormat : "mp3";
            const contentType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
            if (!(format in sorry_audio_base64_1.SORRY_AUDIO_BASE64)) {
                const buffer = Buffer.from(sorry_audio_base64_1.SORRY_AUDIO_BASE64.mp3, "base64");
                return { contentType: "audio/mpeg", content: buffer };
            }
            const buffer = Buffer.from(sorry_audio_base64_1.SORRY_AUDIO_BASE64[format], "base64");
            return {
                contentType: contentType,
                content: buffer,
            };
        };
        return "textToSpeech" in adapter && !!adapter.textToSpeech ? await adapter.textToSpeech(params) : resUnSupported(params.args?.options?.responseFormat);
    },
});
exports.default = llmAdapterHelper;
