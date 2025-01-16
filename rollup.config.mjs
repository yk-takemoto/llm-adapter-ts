import pluginTypescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";

const external = [
  "fs",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "groq-sdk",
  "openai"
];

const globals = {
  "fs": "fs",
  "@anthropic-ai/sdk": "Anthropic",
  "@google/generative-ai": "GenerativeAI",
  "groq-sdk": "GroqSDK",
  "openai": "OpenAI"
};

const plugins = [pluginTypescript(), commonjs()];

export default [
  {
    input: "./src/index.ts",
    output: {
      file: "./lib/bundle.cjs.js",
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins: [...plugins, terser()],
  },
  {
    input: "./src/index.ts",
    output: {
      file: "./lib/bundle.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external,
    plugins,
  },
  {
    input: "./src/index.ts",
    output: {
      name: "llm-handler",
      file: "./lib/bundle.umd.js",
      format: "umd",
      sourcemap: true,
      globals,
    },
    external,
    plugins: [...plugins, terser()],
  },
];