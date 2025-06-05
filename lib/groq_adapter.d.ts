import { z } from "zod";
import { LlmAdapterBuilder } from "./llm_adapter_schemas";
declare const groqClientBuilderArgsSchema: z.ZodObject<{
    apiKey: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    apiKey: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export type GroqClientBuilderArgs = z.infer<typeof groqClientBuilderArgsSchema>;
export declare const groqAdapterBuilder: LlmAdapterBuilder<GroqClientBuilderArgs>;
export {};
