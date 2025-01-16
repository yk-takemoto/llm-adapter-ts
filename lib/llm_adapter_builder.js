"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const openai_adapter_1 = require("./openai_adapter");
const azure_openai_adapter_1 = require("./azure_openai_adapter");
const anthropic_adapter_1 = require("./anthropic_adapter");
const gemini_adapter_1 = require("./gemini_adapter");
const groq_adapter_1 = require("./groq_adapter");
const llmAdapterClasses = {
    OpenAI: openai_adapter_1.OpenAIAdapter,
    AzureOpenAI: azure_openai_adapter_1.AzureOpenAIAdapter,
    Anthropic: anthropic_adapter_1.AnthropicAdapter,
    Google: gemini_adapter_1.GeminiAdapter,
    Groq: groq_adapter_1.GroqAdapter,
};
const llmAdapterBuilder = (llmId) => {
    const llmAdapterClass = llmAdapterClasses[llmId];
    return new llmAdapterClass();
};
exports.default = llmAdapterBuilder;
