"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_adapter_1 = require("./openai_adapter");
const anthropic_adapter_1 = __importDefault(require("./anthropic_adapter"));
const gemini_adapter_1 = __importDefault(require("./gemini_adapter"));
const groq_adapter_1 = __importDefault(require("./groq_adapter"));
const sorry_audio_base64_1 = require("./sorry_audio_base64");
const getAdapter = (llmId) => {
    const llmAdapterMap = {
        OpenAI: openai_adapter_1.openAIAdapterBuilder,
        AzureOpenAI: openai_adapter_1.openAIAdapterBuilder,
        Anthropic: anthropic_adapter_1.default,
        Google: gemini_adapter_1.default,
        Groq: groq_adapter_1.default,
    };
    const adapter = "build" in llmAdapterMap[llmId] ? llmAdapterMap[llmId].build({ args: llmId }) : llmAdapterMap[llmId];
    if (!adapter) {
        throw new Error(`[llmAdapterHelper] Adapter for ${llmId} is not available.`);
    }
    return adapter;
};
const llmAdapterHelper = (llmId) => ({
    chatCompletions: async (args) => {
        const adapter = getAdapter(llmId);
        if (!("chatCompletions" in adapter) || !adapter.chatCompletions) {
            throw new Error(`[llmAdapterHelper#chatCompletions] Adapter for ${llmId} does not support chatCompletions.`);
        }
        return await adapter.chatCompletions({ args });
    },
    speechToText: async (args) => {
        const adapter = getAdapter(llmId);
        const resUnSupported = "unsupported";
        return "speechToText" in adapter && !!adapter.speechToText ? await adapter.speechToText({ args }) : resUnSupported;
    },
    textToSpeech: async (args) => {
        const adapter = getAdapter(llmId);
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
        return "textToSpeech" in adapter && !!adapter.textToSpeech ? await adapter.textToSpeech({ args }) : resUnSupported(args.options?.responseFormat);
    },
});
exports.default = llmAdapterHelper;
