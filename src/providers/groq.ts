import { config } from "../config";
import { convertAnthropicToOpenAI } from "../converters/anthropic-to-openai";
import {
  convertOpenAIToAnthropic,
  convertOpenAIStreamToAnthropic,
} from "../converters/openai-to-anthropic";
import type { AnthropicRequest } from "../types/anthropic";

export async function handleGroqRequest(
  request: Request,
  url: URL
): Promise<Response> {
  // Only handle /v1/messages endpoint for now
  if (!url.pathname.includes("/v1/messages")) {
    return new Response("Not Found", { status: 404 });
  }

  // Parse the incoming Anthropic request
  let anthropicRequest: AnthropicRequest;
  try {
    anthropicRequest = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (config.debug) {
    console.log(
      "Anthropic request:",
      JSON.stringify(anthropicRequest, null, 2)
    );
  }

  // Convert Anthropic request to OpenAI format
  const openaiRequest = convertAnthropicToOpenAI(anthropicRequest, config.groq.model);

  if (config.debug) {
    console.log("OpenAI request:", JSON.stringify(openaiRequest, null, 2));
  }

  // Build the target URL for Groq
  const targetUrl = new URL(`${config.groq.baseUrl}/chat/completions`);

  // Prepare headers for Groq
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${config.groq.apiKey}`);

  if (config.debug) {
    console.log(`Forwarding to: ${targetUrl.toString()}`);
  }

  try {
    // Send request to Groq
    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(openaiRequest),
    });

    if (config.debug) {
      console.log(`Groq response: ${response.status} ${response.statusText}`);
    }

    if (!response.ok) {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Handle streaming response
    if (anthropicRequest.stream) {
      return handleStreamingResponse(response, anthropicRequest);
    }

    // Handle non-streaming response
    const openaiResponse = await response.json();

    if (config.debug) {
      console.log("OpenAI response:", JSON.stringify(openaiResponse, null, 2));
    }

    const anthropicResponse = convertOpenAIToAnthropic(
      openaiResponse,
      anthropicRequest
    );

    if (config.debug) {
      console.log(
        "Anthropic response:",
        JSON.stringify(anthropicResponse, null, 2)
      );
    }

    return new Response(JSON.stringify(anthropicResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Groq request failed:", error);
    return new Response(
      JSON.stringify({
        type: "error",
        error: {
          type: "api_error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

async function handleStreamingResponse(
  response: Response,
  anthropicRequest: AnthropicRequest
): Promise<Response> {
  if (!response.body) {
    throw new Error("No response body for streaming");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        async function* readLines() {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              yield line;
            }
          }
          if (buffer) {
            yield buffer;
          }
        }

        const anthropicStream = convertOpenAIStreamToAnthropic(
          readLines(),
          anthropicRequest
        );

        for await (const chunk of anthropicStream) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }

        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
