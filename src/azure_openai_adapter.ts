import { AzureOpenAI } from "openai";
import { z } from "zod";
import { OpenAIAdapter } from "@/openai_adapter";

export class AzureOpenAIAdapter extends OpenAIAdapter<AzureOpenAI> {
  constructor(
    llmConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY,
      apiModelChat: process.env.AZURE_OPENAI_API_DEPLOYMENT_CHAT,
      apiModelAudioTranscription: process.env.AZURE_OPENAI_API_DEPLOYMENT_AUDIO_TRANSCRIPTION,
      apiModelText2Speech: process.env.AZURE_OPENAI_API_DEPLOYMENT_TEXT2SPEECH,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.OPENAI_API_VERSION,
    },
    llmConfigSchema = z.object({
      apiKey: z.string().min(1, "AZURE_OPENAI_API_KEY is required"),
      apiModelChat: z.string().min(1, "AZURE_OPENAI_API_DEPLOYMENT_CHAT is required"),
      apiModelAudioTranscription: z.string().optional(),
      apiModelText2Speech: z.string().optional(),
      endpoint: z.string().min(1, "AZURE_OPENAI_ENDPOINT is required"),
      apiVersion: z.string().min(1, "OPENAI_API_VERSION is required"),
    }),
  ) {
    const apiClient = new AzureOpenAI({ apiKey: llmConfig.apiKey, endpoint: llmConfig.endpoint, apiVersion: llmConfig.apiVersion });
    super(llmConfig, llmConfigSchema, apiClient);
  }
}
