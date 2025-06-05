import { z } from "zod";
import { LlmAdapterBuilder } from "./llm_adapter_schemas";
declare const anthropicClientBuilderArgsSchema: z.ZodObject<{
    apiKey: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export type AnthropicClientBuilderArgs = z.infer<typeof anthropicClientBuilderArgsSchema>;
export declare const anthropicAdapterBuilder: LlmAdapterBuilder<AnthropicClientBuilderArgs>;
export {};
