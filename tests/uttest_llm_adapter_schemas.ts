import { z } from "zod";
import { LlmAdapterAsyncFunction } from "../src/llm_adapter_schemas";

const sampleArgsSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
});
type SampleArgs = z.infer<typeof sampleArgsSchema>;
const __sampleResultSchema = z.object({
  message: z.string(),
});
export type SampleResult = z.infer<typeof __sampleResultSchema>;

const sampleFunction: LlmAdapterAsyncFunction<SampleArgs, SampleResult> = async ({
  args,
  argsSchema = sampleArgsSchema,
  config,
  configSchema = z.object({ someConfig: z.string() }),
} = {}) => {
  const convArgs = argsSchema?.parse(args);
  console.log("Arguments:", args);
  console.log("Coverted Arguments:", convArgs);
  if (configSchema) {
    const covConfig = configSchema.parse(config);
    console.log("Config:", config);
    console.log("Converted Config:", covConfig);
  }
  return { message: "Function executed successfully" };
};

sampleFunction({
  args: { param1: "test", param2: 42 },
  config: { someConfig: "value" },
})
  .then((result) => {
    console.log("Result:", result);
  })
  .catch((error) => {
    console.error("Error:", error);
  });
