import { z } from "zod";
import { LlmAdapterBuilder } from "./llm_adapter_schemas";
declare const geminiClientBuilderArgsSchema: z.ZodObject<{
    apiKey: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export type GeminiClientBuilderArgs = z.infer<typeof geminiClientBuilderArgsSchema>;
export declare const geminiAdapterBuilder: LlmAdapterBuilder<GeminiClientBuilderArgs>;
export {};
