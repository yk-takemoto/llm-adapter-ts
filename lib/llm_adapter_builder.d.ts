import { LlmAdapter } from "./llm_adapter";
declare const llmAdapterBuilder: (llmId: string) => LlmAdapter;
export default llmAdapterBuilder;
