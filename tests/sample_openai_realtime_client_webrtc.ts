import { testList } from "./sample_realtime_testcases";

const envConfig = {
  OPENAI_REALTIME_RTC_URL: "https://api.openai.com/v1/realtime",
  OPENAI_REALTIME_API_MODEL: "gpt-4o-realtime-preview-2025-06-03",
  AZURE_OPENAI_REALTIME_RTC_URL: "https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc",
  AZURE_OPENAI_REALTIME_API_DEPLOYMENT: "gpt-4o-mini-realtime-preview",
};

let testCount = 0;
let outputDiv: HTMLElement;

document.addEventListener("DOMContentLoaded", () => {
    outputDiv = document.getElementById("output")!;
    document.getElementById("startSessionButton")?.addEventListener("click", async (e) => {
        (e.target as HTMLButtonElement).disabled = true;
        const clientType = document.querySelector('input[name="clientType"]:checked') as HTMLInputElement;
        await initializeWebRTC(clientType.value as "openai" | "azureOpenAI");
    });
    document.getElementById("stopSessionButton")?.addEventListener("click", (e) => {
        if (dc) {
            dc.close();
            outputDiv.textContent += "WebRTC data channel closed.\n";
        }
        (e.target as HTMLButtonElement).disabled = true;
        (document.getElementById("startSessionButton") as HTMLButtonElement).disabled = false;
        (document.getElementById("runTestcasesButton") as HTMLButtonElement).disabled = true;
        (document.getElementById("sendTextButton") as HTMLButtonElement).disabled = true;
        isRunningTestcase = false;
        testCount = 0;
    });
    document.getElementById("runTestcasesButton")?.addEventListener("click", runTestcases);
    document.getElementById("sendTextButton")?.addEventListener("click", () => {
        const textInput = (document.getElementById("textInput") as HTMLInputElement).value;
        if (textInput) {
            sendTextRequest(textInput);
            (document.getElementById("textInput") as HTMLInputElement).value = "";
        }
    });
    document.getElementById("clearOutputButton")?.addEventListener("click", () => {
        outputDiv.textContent = "";
    });
});

let dc: RTCDataChannel;
let isRunningTestcase = false;

const initializeWebRTC = async (clientType: "openai" | "azureOpenAI") => {
  // Get an ephemeral key from your server - see server code below
  const tokenResponse = await fetch(`/session?clientType=${clientType}`);
  const data = await tokenResponse.json();

  // debug
  console.log("WebRTC Session received:", JSON.stringify(data, null, 2));

  const EPHEMERAL_KEY = data.client_secret.value;

  // Create a peer connection
  const pc = new RTCPeerConnection();
  
  // Set up to play remote audio from the model
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = e => audioEl.srcObject = e.streams[0];

  // Add local audio track for microphone input in the browser
  const ms = await navigator.mediaDevices.getUserMedia({
    audio: true
  });
  pc.addTrack(ms.getTracks()[0]);

  // Set up data channel for sending and receiving events
  dc = pc.createDataChannel("oai-events");

  dc.onopen = () => {
    outputDiv.textContent += "WebRTC data channel is open.\n";

    // initial session update
    dc.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: "You are a Japanese-speaking assistant. Please answer briefly.",
      },
    }));

    (document.getElementById("stopSessionButton") as HTMLButtonElement).disabled = false;
    (document.getElementById("runTestcasesButton") as HTMLButtonElement).disabled = false;
    (document.getElementById("sendTextButton") as HTMLButtonElement).disabled = false;
    // outputDiv.textContent += `\nRunning ${testList.length} test cases...\n`;
    // outputDiv.textContent += "========================================\n";

    // outputDiv.textContent += `\n${testList[testCount].description}\n`;
    // testList[testCount].events.forEach((item) => {
    //   dc.send(JSON.stringify(item));
    // });
    // outputDiv.textContent += "========================================\n";
  };

  dc.onmessage = (e) => {
    const event = JSON.parse(e.data.toString());
    if (event.type === "response.text.delta" || event.type === "response.audio_transcript.delta" || event.type === "response.function_call_arguments.delta") {
      outputDiv.textContent += event.delta;
    } else if (event.type === "response.text.done" || event.type === "response.audio_transcript.done") {
      outputDiv.textContent += "\n";
    } else if (event.type === "session.updated") {
      // debug
      console.log(`TestCount${testCount} Session updated: ${JSON.stringify(event.session, null, 2)}`);
    } else if (event.type === "response.done") {
      outputDiv.textContent += `\nTestCount${testCount} Response done\n`;
      outputDiv.textContent += "========================================\n";
      // debug
      console.log(`TestCount${testCount} Response done: ${JSON.stringify(event.response, null, 2)}`);
      if (isRunningTestcase) {
        testCount++;
        if (testCount < testList.length) {
          outputDiv.textContent += `\n${testList[testCount].description}\n`;
          testList[testCount].events.forEach((item) => {
            dc.send(JSON.stringify(item));
          });
        } else {
          outputDiv.textContent += "\nAll test cases completed.\n";
          testCount = 0;
          isRunningTestcase = false;
          (document.getElementById("runTestcasesButton") as HTMLButtonElement).disabled = false;
        }
        outputDiv.textContent += "========================================\n";
      } else {
        (document.getElementById("sendTextButton") as HTMLButtonElement).disabled = false;
      }
    }
    // else {
    //   // debug
    //   outputDiv.textContent += `Received unknown event: ${JSON.stringify(event, null, 2)}\n`;
    // }
  };

  dc.onerror = (error) => {
    console.error("WebRTC data channel error:", error);
  };

  dc.onclose = () => {
    console.log("WebRTC data channel closed.");
  };

  // Start the session using the Session Description Protocol (SDP)
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = clientType === "azureOpenAI" ? envConfig.AZURE_OPENAI_REALTIME_RTC_URL : envConfig.OPENAI_REALTIME_RTC_URL;
  const model = clientType === "azureOpenAI" ? envConfig.AZURE_OPENAI_REALTIME_API_DEPLOYMENT : envConfig.OPENAI_REALTIME_API_MODEL;
  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp"
    },
  });

  const answer = {
    type: "answer" as const,
    sdp: await sdpResponse.text(),
  };
  await pc.setRemoteDescription(answer);
};

const runTestcases = async () => {
  if (!dc || dc.readyState !== "open") {
    outputDiv.textContent += "WebRTC data channel is not open.\n";
    return;
  }
  isRunningTestcase = true;
  (document.getElementById("runTestcasesButton") as HTMLButtonElement).disabled = true;
  testCount = 0;
  outputDiv.textContent = ""; // Clear previous output

  outputDiv.textContent += `\nRunning ${testList.length} test cases...\n`;
  outputDiv.textContent += "========================================\n";

  outputDiv.textContent += `\n${testList[testCount].description}\n`;
  testList[testCount].events.forEach((item) => {
    dc.send(JSON.stringify(item));
  });
  outputDiv.textContent += "========================================\n";
};

const sendTextRequest = (text: string) => {
  if (!dc || dc.readyState !== "open") {
    outputDiv.textContent += "WebRTC data channel is not open.\n";
    return;
  }
  (document.getElementById("sendTextButton") as HTMLButtonElement).disabled = true;
  dc.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text,
        },
      ],
    },
  }));
  outputDiv.textContent += `\nSent message: ${text}\n`;
  outputDiv.textContent += "========================================\n";
  dc.send(JSON.stringify({
    type: "response.create",
  }));
};