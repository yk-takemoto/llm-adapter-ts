import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  AuthToken,
  FunctionDeclaration,
  FunctionResponse,
  GoogleGenAI,
  LiveServerMessage,
  MediaResolution,
  Modality,
  Type,
} from "@google/genai";

dotenv.config({ path: ".env.test" });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_REALTIME_MODALITY = process.argv[2] || "text";
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;
const GOOGLE_GENAI_MLDEV_USE_EPHEMERAL =
  process.env.GOOGLE_GENAI_MLDEV_USE_EPHEMERAL;

class AsyncQueue<T> {
  private queue: T[] = [];
  private waiting: ((value: T) => void)[] = [];

  /**
   * Adds an item to the queue.
   * If there"s a waiting consumer, it resolves immediately.
   * @param item The item to add to the queue.
   */
  put(item: T): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      if (resolve) {
        resolve(item);
      }
    } else {
      this.queue.push(item);
    }
  }

  /**
   * Gets the next item from the queue.
   * If the queue is empty, it waits for an item to be added.
   * @return A Promise that resolves with the next item.
   */
  get(): Promise<T> {
    return new Promise<T>((resolve) => {
      if (this.queue.length > 0) {
        resolve(this.queue.shift()!);
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  /**
   * Returns the number of items in the queue.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Returns true if the queue is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clears the queue.
   */
  clear(): void {
    this.queue = [];
    this.waiting = [];
  }
}

const live = async (client: GoogleGenAI, model: string) => {
  const responseQueue = new AsyncQueue<LiveServerMessage>();

  const handleTurn = async (): Promise<LiveServerMessage[]> => {
    const turn: LiveServerMessage[] = [];
    while (true) {
      const message = await responseQueue.get();
      turn.push(message);
      if (message.serverContent?.turnComplete || message.toolCall) {
        return turn;
      }
    }
  };

  const createWavHeader = (dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer => {
    const header = Buffer.alloc(44);
    
    // RIFF header
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataLength, 4);
    header.write("WAVE", 8);
    
    // fmt chunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28);
    header.writeUInt16LE(channels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write("data", 36);
    header.writeUInt32LE(dataLength, 40);
    
    return header;
  };

  // Config for Modality.TEXT
  const configForText = {
    systemInstruction: "You are a helpful assistant and answer in Japanese in a friendly tone.",
    responseModalities: [Modality.TEXT],
    contextWindowCompression: {
      triggerTokens: "25600",
      slidingWindow: { targetTokens: "12800" },
    },
  };
  // Config for Modality.AUDIO
  const configForAudio = {
    systemInstruction: "You are a helpful assistant and answer in Japanese in a friendly tone.",
    responseModalities: [Modality.AUDIO],
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Zephyr",
        },
      },
    },
    contextWindowCompression: {
      triggerTokens: "25600",
      slidingWindow: { targetTokens: "12800" },
    },
  };

  const session = await client.live.connect({
    model,
    callbacks: {
      onopen: () => {
        console.debug("Opened");
      },
      onmessage: (message: LiveServerMessage) => {
        responseQueue.put(message);
      },
      onerror: (e: ErrorEvent) => {
        console.debug("Error:", e.message);
      },
      onclose: (e: CloseEvent) => {
        console.debug("Close:", e.reason);
        responseQueue.clear();
      },
    },
    config: GEMINI_REALTIME_MODALITY === "audio" ? configForAudio : configForText,
  });

  // Send a simple text message
  const simple = "Hello world";
  console.log("-".repeat(80));
  console.log(`Sent: ${simple}`);
  session.sendClientContent({turns: simple});

  const simpleTurnRes = await handleTurn();

  if (GEMINI_REALTIME_MODALITY === "audio") {
    const audioChunks: string[] = [];
    for (const message of simpleTurnRes) {
      const inlineData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (inlineData) {
        audioChunks.push(inlineData);
      }
    }
    
    if (audioChunks.length > 0) {
      const combinedBase64 = audioChunks.join("");
      const audioBuffer = Buffer.from(combinedBase64, "base64");

      const sampleRate = 24000;
      const channels = 1;
      const bitsPerSample = 16;
      const wavHeader = createWavHeader(audioBuffer.length, sampleRate, channels, bitsPerSample);
      const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);

      const outputPath = path.join(__dirname, "output_audio_1.wav");
      fs.writeFileSync(outputPath, wavBuffer);
      console.log(`Audio saved to: ${outputPath}`);
    } else {
      console.log("No audio data found in response");
    }
  } else {
    for (const turn of simpleTurnRes) {
      if (turn.text) {
        for (const part of turn.serverContent?.modelTurn?.parts || []) {
          if (part.text) {
            console.debug('Received text: %s\n', part.text);
          } else if (part.executableCode) {
            console.debug('executableCode: %s\n', part.executableCode.code);
          } else if (part.codeExecutionResult) {
            console.debug('codeExecutionResult: %s\n', part.codeExecutionResult.output);
          }
        }
      }
    }
  }

  // Send an image with inline data
  const turns = [
    "This image is just black, can you see it?",
    {
      inlineData: {
        // 2x2 black PNG, base64 encoded.
        data: "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAC0lEQVR4nGNgQAYAAA4AAamRc7EAAAAASUVORK5CYII=",
        mimeType: "image/png",
      },
    },
  ];
  console.log("-".repeat(80));
  console.log(`Sent: ${turns}`);
  session.sendClientContent({turns: turns});

  const imageTurnRes = await handleTurn();

  if (GEMINI_REALTIME_MODALITY === "audio") {
    const audioChunks: string[] = [];
    for (const message of imageTurnRes) {
      const inlineData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (inlineData) {
        audioChunks.push(inlineData);
      }
    }
    
    if (audioChunks.length > 0) {
      const combinedBase64 = audioChunks.join("");
      const audioBuffer = Buffer.from(combinedBase64, "base64");

      const sampleRate = 24000;
      const channels = 1;
      const bitsPerSample = 16;
      const wavHeader = createWavHeader(audioBuffer.length, sampleRate, channels, bitsPerSample);
      const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);

      const outputPath = path.join(__dirname, "output_audio_2.wav");
      fs.writeFileSync(outputPath, wavBuffer);
      console.log(`Audio saved to: ${outputPath}`);
    } else {
      console.log("No audio data found in response");
    }
  } else {
    for (const turn of imageTurnRes) {
      if (turn.text) {
        for (const part of turn.serverContent?.modelTurn?.parts || []) {
          if (part.text) {
            console.debug('Received text: %s\n', part.text);
          } else if (part.executableCode) {
            console.debug('executableCode: %s\n', part.executableCode.code);
          } else if (part.codeExecutionResult) {
            console.debug('codeExecutionResult: %s\n', part.codeExecutionResult.output);
          }
        }
      }
    }
  }

  // Send a text message for a tool call
  const lightControlFunction: FunctionDeclaration = {
    // behavior: Behavior.NON_BLOCKING,
    name: "light_control",
    description: "Control the lighting in a living room.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        power: {
          type: Type.STRING,
          description: "The power state of the light (on/off).",
        },
      },
      required: ["power"],
    },
  };

  const tools = [
    { functionDeclarations: [lightControlFunction] },
    { googleSearch: {} },
    { codeExecution: {} },
  ];

  // Config for Modality.TEXT
  const toolConfigForText = {
    ...configForText,
    tools,
  };
  // Config for Modality.AUDIO
  const toolConfigForAudio = {
    ...configForAudio,
    tools,
  };

  const toolSession = await client.live.connect({
    model,
    callbacks: {
      onopen: () => {
        console.debug("Opened");
      },
      onmessage: (message: LiveServerMessage) => {
        responseQueue.put(message);
      },
      onerror: (e: ErrorEvent) => {
        console.debug("Error:", e.message);
      },
      onclose: (e: CloseEvent) => {
        console.debug("Close:", e.reason);
        responseQueue.clear();
      },
    },
    config: GEMINI_REALTIME_MODALITY === "audio" ? toolConfigForAudio : toolConfigForText,
  });


  const toolsCallTurns = `Hey, I need you to do three things for me.

    1. Turn on the lights
    2. Compute the largest prime palindrome under 100000.
    3. Then use Google Search to look up information about the largest earthquake in California the week of Dec 5 2024?

    Thanks!
  `;
  console.log("-".repeat(80));
  console.log(`Sent: ${toolsCallTurns}`);
  toolSession.sendClientContent({turns: toolsCallTurns});

  const toolCallTurnRes = await handleTurn();

  for (const turn of toolCallTurnRes) {
    if (turn.text) {
      for (const part of turn.serverContent?.modelTurn?.parts || []) {
        if (part.text) {
          console.debug('Received text: %s\n', part.text);
        } else if (part.executableCode) {
          console.debug('executableCode: %s\n', part.executableCode.code);
        } else if (part.codeExecutionResult) {
          console.debug('codeExecutionResult: %s\n', part.codeExecutionResult.output);
        }
      }
    } else if (turn.toolCall) {
      const functionResponses: FunctionResponse[] = [];
      for (const fc of turn.toolCall.functionCalls || []) {
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: {
            result: "ok",
            // scheduling: FunctionResponseScheduling.WHEN_IDLE,
          },
        });
      }

      console.debug('Sending tool response...\n');
      toolSession.sendToolResponse({ functionResponses });
    }
  }

  // Check again for new messages after sending the tool response
  const afterToolCallRes = await handleTurn();

  if (GEMINI_REALTIME_MODALITY === "audio") {
    const audioChunks: string[] = [];
    for (const message of afterToolCallRes) {
      const inlineData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (inlineData) {
        audioChunks.push(inlineData);
      }
    }
    
    if (audioChunks.length > 0) {
      const combinedBase64 = audioChunks.join("");
      const audioBuffer = Buffer.from(combinedBase64, "base64");

      const sampleRate = 24000;
      const channels = 1;
      const bitsPerSample = 16;
      const wavHeader = createWavHeader(audioBuffer.length, sampleRate, channels, bitsPerSample);
      const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);

      const outputPath = path.join(__dirname, "output_audio_3.wav");
      fs.writeFileSync(outputPath, wavBuffer);
      console.log(`Audio saved to: ${outputPath}`);
    } else {
      console.log("No audio data found in response");
    }
  } else {
    for (const turn of afterToolCallRes) {
      if (turn.text) {
        for (const part of turn.serverContent?.modelTurn?.parts || []) {
          if (part.text) {
            console.debug('Received text: %s\n', part.text);
          } else if (part.executableCode) {
            console.debug('executableCode: %s\n', part.executableCode.code);
          } else if (part.codeExecutionResult) {
            console.debug('codeExecutionResult: %s\n', part.codeExecutionResult.output);
          }
        }
      }
    }
  }

  session.close();
  toolSession.close();
};

async function main() {
  if (GOOGLE_GENAI_USE_VERTEXAI) {
    const client = new GoogleGenAI({
      vertexai: true,
      project: GOOGLE_CLOUD_PROJECT,
      location: GOOGLE_CLOUD_LOCATION,
    });
    const model = "gemini-2.0-flash-live-preview-04-09";
    await live(client, model).catch((e) => console.error("got error", e));
    return;
  }

  const model = "gemini-live-2.5-flash-preview";
  let client = new GoogleGenAI({
    vertexai: false,
    apiKey: GEMINI_API_KEY,
  });

  if (GOOGLE_GENAI_MLDEV_USE_EPHEMERAL) {
    // Create the ephemeral token, normally you"d do this on your server
    // using your API key.
    const token: AuthToken = await client.authTokens.create({
      config: {
        uses: 1, // The default
        liveConnectConstraints: {
          model: model,
          config: {
            responseModalities: [Modality.TEXT],
          },
        },
        // Ephemeral tokens only work on v1alpha for now.
        httpOptions: {apiVersion: "v1alpha"},
      },
    });
    console.log("Token:", JSON.stringify(token));

    // Use the auth token to create a client
    // This client can only call live.connect, never sees your api key.
    client = new GoogleGenAI({
      apiKey: token.name,
      apiVersion: "v1alpha",
    });
  }

  await live(client, model).catch((e) => console.error("got error", e));
}

main();