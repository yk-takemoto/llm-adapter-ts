import pluginTypescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";

const external = [
  "fs",
  "zod",
  "@anthropic-ai/sdk",
  "@google/genai",
  "groq-sdk",
  "openai"
];

const globals = {
  "fs": "fs",
  "zod": "zod",
  "@anthropic-ai/sdk": "Anthropic",
  "@google/genai": "GoogleGenAI",
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