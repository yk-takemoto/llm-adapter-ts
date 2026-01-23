import { z } from "zod";
import { LlmAdapterBuilder } from "./llm_adapter_schemas";
declare const amazonBedrockClientBuilderArgsSchema: z.ZodObject<{
    region: z.ZodString;
    accessKeyId: z.ZodOptional<z.ZodString>;
    secretAccessKey: z.ZodOptional<z.ZodString>;
    sessionToken: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    region: z.ZodString;
    accessKeyId: z.ZodOptional<z.ZodString>;
    secretAccessKey: z.ZodOptional<z.ZodString>;
    sessionToken: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    region: z.ZodString;
    accessKeyId: z.ZodOptional<z.ZodString>;
    secretAccessKey: z.ZodOptional<z.ZodString>;
    sessionToken: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export type AmazonBedrockClientBuilderArgs = z.infer<typeof amazonBedrockClientBuilderArgsSchema>;
export declare const amazonBedrockAdapterBuilder: LlmAdapterBuilder<AmazonBedrockClientBuilderArgs>;
export {};
