import dotenv from "dotenv";
import { OpenAIRealtimeWS } from "openai/beta/realtime/ws";
import OpenAI, { AzureOpenAI } from "openai";
import { testList } from "./sample_realtime_testcases";

dotenv.config({ path: ".env.test" });

const clientType = "openai" as "openai" | "azureOpenAI";

let testCount = 0;

async function main() {
  const rt =
    clientType === "azureOpenAI"
      ? await OpenAIRealtimeWS.azure(
          new AzureOpenAI({
            apiKey: process.env.AZURE_OPENAI_REALTIME_API_KEY,
            endpoint: process.env.AZURE_OPENAI_REALTIME_ENDPOINT,
            apiVersion: process.env.OPENAI_REALTIME_API_VERSION,
            deployment: process.env.AZURE_OPENAI_REALTIME_API_DEPLOYMENT,
          }),
        )
      : new OpenAIRealtimeWS({ model: process.env.OPENAI_REALTIME_API_MODEL! }, new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

  rt.socket.on("open", () => {
    console.log("Connected to WebSocket server.");

    console.log(`\nRunning ${testList.length} test cases...`);
    console.log("========================================");

    console.log(`\n${testList[testCount].description}`);
    testList[testCount].events.forEach((item) => {
      rt.send(item);
    });
    console.log("========================================");
  });

  rt.on("error", (err) => {
    // in a real world scenario this should be logged somewhere as you
    // likely want to continue processing events regardless of any errors
    throw err;
  });

  rt.on("session.updated", (event) => {
    // debug
    console.log(`TestCount${testCount} Session updated: ${JSON.stringify(event.session, null, 2)}`);
  });

  rt.on("response.text.delta", (event) => process.stdout.write(event.delta));
  rt.on("response.audio_transcript.delta", (event) => process.stdout.write(event.delta));
  rt.on("response.function_call_arguments.delta", (event) => process.stdout.write(event.delta));

  rt.on("response.text.done", () => console.log());
  rt.on("response.audio_transcript.done", () => console.log());

  rt.on("response.done", (event) => {
    // debug
    console.log(`TestCount${testCount} Response done: ${JSON.stringify(event.response, null, 2)}`);
    testCount++;
    if (testCount < testList.length) {
      console.log(`\n${testList[testCount].description}`);
      testList[testCount].events.forEach((item) => {
        rt.send(item);
      });
    } else {
      console.log("\nAll test cases completed.");
      rt.socket.close(); // Close the WebSocket connection after the response is done
    }
    console.log("========================================");
  });

  rt.socket.on("close", () => console.log("\nWebSocket connection closed!"));
}

main().catch(console.error);
