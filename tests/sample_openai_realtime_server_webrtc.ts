import dotenv from "dotenv";
import express from "express";
// import OpenAI from "openai";

dotenv.config({ path: ".env.test" });
const app = express();
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// app.get("/session", async (_req, reply) => {
//   const sessionConfig = {
//     model: "gpt-4o-realtime-preview-2025-06-03" as const,
//     modalities: ["text" as const],
//     // connection: { type: "webrtc" }
//   };

//   const res = await openai.beta.realtime.sessions.create(sessionConfig).asResponse();

//   // debug
//   console.log("Session created res.body:", JSON.stringify(res.body, null, 2));

//   reply.send(res.body);
// });

app.get("/session", async (req, res) => {
  const clientType = req.query.clientType as "openai" | "azureOpenAI" | undefined;
  const sessionUrl = clientType === "azureOpenAI" ? process.env.AZURE_OPENAI_REALTIME_SESSION_URL : process.env.OPENAI_REALTIME_SESSION_URL;
  const apiKey = clientType === "azureOpenAI" ? process.env.AZURE_OPENAI_REALTIME_API_KEY : process.env.OPENAI_API_KEY;
  const model = clientType === "azureOpenAI" ? process.env.AZURE_OPENAI_REALTIME_API_DEPLOYMENT : process.env.OPENAI_REALTIME_API_MODEL;

  const r = await fetch(sessionUrl!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "gpt-4o-realtime-preview",
      voice: "verse",
    }),
  });
  const data = await r.json();

  // debug
  console.log("Session created: ", JSON.stringify(data, null, 2));

  // Send back the JSON we received from the OpenAI REST API
  res.send(data);
});

app.listen({ port: 3000 });
