import dotenv from "dotenv";
import WebSocket from "ws";
import { testList } from "./sample_realtime_testcases";

dotenv.config({ path: ".env.test" });

const clientType = "openai" as "openai" | "azureOpenAI";

let testCount = 0;

function main() {
  const url =
    clientType === "azureOpenAI"
      ? `${process.env.AZURE_OPENAI_REALTIME_WS_URL}?api-version=${process.env.OPENAI_REALTIME_API_VERSION}&deployment=${process.env.AZURE_OPENAI_REALTIME_API_DEPLOYMENT}`
      : `${process.env.OPENAI_REALTIME_WS_URL}?model=${process.env.OPENAI_REALTIME_API_MODEL}`;
  const apiKey = clientType === "azureOpenAI" ? process.env.AZURE_OPENAI_REALTIME_API_KEY : process.env.OPENAI_API_KEY;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: "Bearer " + apiKey,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  ws.on("open", () => {
    console.log("Connected to WebSocket server.");

    console.log(`\nRunning ${testList.length} test cases...`);
    console.log("========================================");

    console.log(`\n${testList[testCount].description}`);
    testList[testCount].events.forEach((item) => {
      ws.send(JSON.stringify(item));
    });
    console.log("========================================");
  });

  ws.onmessage = (e) => {
    const event = JSON.parse(e.data.toString());
    if (event.type === "response.text.delta" || event.type === "response.audio_transcript.delta" || event.type === "response.function_call_arguments.delta") {
      process.stdout.write(event.delta);
    } else if (event.type === "response.text.done" || event.type === "response.audio_transcript.done") {
      console.log();
    } else if (event.type === "session.updated") {
      // debug
      console.log(`TestCount${testCount} Session updated: ${JSON.stringify(event.session, null, 2)}`);
    } else if (event.type === "response.done") {
      // debug
      console.log(`TestCount${testCount} Response done: ${JSON.stringify(event.response, null, 2)}`);
      testCount++;
      if (testCount < testList.length) {
        console.log(`\n${testList[testCount].description}`);
        testList[testCount].events.forEach((item) => {
          ws.send(JSON.stringify(item));
        });
      } else {
        console.log("\nAll test cases completed.");
        ws.close(); // Close the WebSocket connection after the response is done
      }
      console.log("========================================");
    }
  };

  ws.onclose = () => {
    console.log("\nWebSocket connection closed!");
  };
}

main();
