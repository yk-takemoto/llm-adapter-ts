"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAIAdapter = void 0;
const openai_1 = require("openai");
const zod_1 = require("zod");
const openai_adapter_1 = require("./openai_adapter");
class AzureOpenAIAdapter extends openai_adapter_1.OpenAIAdapter {
    constructor(llmConfig = {
        apiKey: JSON.parse(process.env.APP_SECRETS || "{}").AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY,
        apiModelChat: process.env.AZURE_OPENAI_API_DEPLOYMENT_CHAT,
        apiModelAudioTranscription: process.env.AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION,
        apiModelText2Speech: process.env.AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.OPENAI_API_VERSION,
    }, llmConfigSchema = zod_1.z.object({
        apiKey: zod_1.z.string().min(1, "AZURE_OPENAI_API_KEY is required"),
        apiModelChat: zod_1.z.string().min(1, "AZURE_OPENAI_API_DEPLOYMENT_CHAT is required"),
        apiModelAudioTranscription: zod_1.z.string().optional(),
        apiModelText2Speech: zod_1.z.string().optional(),
        endpoint: zod_1.z.string().min(1, "AZURE_OPENAI_ENDPOINT is required"),
        apiVersion: zod_1.z.string().min(1, "OPENAI_API_VERSION is required"),
    })) {
        const apiClient = new openai_1.AzureOpenAI({ apiKey: llmConfig.apiKey, endpoint: llmConfig.endpoint, apiVersion: llmConfig.apiVersion });
        super(llmConfig, llmConfigSchema, apiClient);
    }
}
exports.AzureOpenAIAdapter = AzureOpenAIAdapter;
