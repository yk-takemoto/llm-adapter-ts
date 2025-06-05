import { z } from "zod";
import { LlmAdapterBuilder } from "./llm_adapter_schemas";
declare const openAIClientBuilderArgsSchema: z.ZodObject<{
    apiKey: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
declare const azureOpenAIClientBuilderArgsSchema: z.ZodObject<{
    apiKey: z.ZodString;
    endpoint: z.ZodString;
    apiVersion: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    apiKey: z.ZodString;
    endpoint: z.ZodString;
    apiVersion: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    apiKey: z.ZodString;
    endpoint: z.ZodString;
    apiVersion: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
type OpenAIClientBuilderArgs = z.infer<typeof openAIClientBuilderArgsSchema>;
type AzureOpenAIClientBuilderArgs = z.infer<typeof azureOpenAIClientBuilderArgsSchema>;
export declare const openAIAdapterBuilder: LlmAdapterBuilder<OpenAIClientBuilderArgs | AzureOpenAIClientBuilderArgs>;
export {};
