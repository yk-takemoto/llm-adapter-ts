import { z } from "zod";

export const llmChatCompletionsResponseSchema = z.object({
  text: z.string().nullable(),
  tools: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      arguments: z.record(z.any()),
    }),
  ),
  messages: z.array(z.any()),
});

export const llmChatCompletionsContentSchema = z.object({
  text: z.string().optional(),
  image: z
    .object({
      url: z.string(),
      detail: z.any().optional(),
    })
    .optional(),
  audio: z
    .object({
      data: z.string(),
      format: z.any().optional(),
    })
    .optional(),
});

export const llmChatCompletionsOptionsSchema = z.object({
  tools: z.array(z.any()).optional(),
  toolOption: z.object({
    choice: z.any().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    type: z.enum(["function", "function_strict", "response_format"]).optional(),
  }),
});
// .catchall(z.any());

export const llmTextToSpeechResponseSchema = z.object({
  contentType: z.string(),
  content: z.instanceof(Buffer),
});

export const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.object({
    type: z.string(),
    properties: z.record(z.any()),
    required: z.array(z.string()),
  }),
});

export type LlmChatCompletionsResponse = z.infer<typeof llmChatCompletionsResponseSchema>;
export type LlmChatCompletionsContent = z.infer<typeof llmChatCompletionsContentSchema>;
export type LlmChatCompletionsOptions = z.infer<typeof llmChatCompletionsOptionsSchema>;
export type LlmTextToSpeechResponse = z.infer<typeof llmTextToSpeechResponseSchema>;
export type McpTool = z.infer<typeof mcpToolSchema>;
