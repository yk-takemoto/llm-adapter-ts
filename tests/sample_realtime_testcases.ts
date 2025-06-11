export const testList: { description: string; events: any[] }[] = [
  {
    description: "Test case 1: Simple text input",
    events: [
      {
        type: "session.update",
        session: {
          //   modalities: ["text"],
          instructions: "You are a Japanese-speaking assistant. Please answer briefly.",
        },
      },
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "How is the weather in Tokyo today?",
            },
          ],
        },
      },
      {
        type: "response.create",
        // response: {
        //   modalities: ["text"],
        // },
      },
    ],
  },
  {
    description: "Test case 2: Tool call",
    events: [
      {
        type: "session.update",
        session: {
          modalities: ["text"],
          instructions: "You are a Japanese-speaking assistant. Please answer briefly.",
          tools: [
            {
              type: "function",
              name: "get_weather",
              description: "Get the current weather in a specified city.",
              parameters: {
                type: "object",
                properties: {
                  city: {
                    type: "string",
                    description: "The name of the city to get the weather for.",
                  },
                },
                required: ["city"],
              },
            },
          ],
          tool_choice: "auto",
        },
      },
      {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "How is the weather in Tokyo today?",
            },
          ],
        },
      },
      {
        type: "response.create",
        response: {
          modalities: ["text"],
        },
      },
    ],
  },
];
