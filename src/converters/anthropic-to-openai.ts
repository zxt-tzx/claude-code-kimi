import type { AnthropicRequest, AnthropicMessage } from "../types/anthropic";
import type { OpenAIRequest, OpenAIMessage } from "../types/openai";

export function convertAnthropicToOpenAI(
  anthropicRequest: AnthropicRequest,
  targetModel?: string
): OpenAIRequest {
  const openaiMessages: OpenAIMessage[] = [];

  // Add system message if present
  if (anthropicRequest.system) {
    let systemText = "";
    if (typeof anthropicRequest.system === "string") {
      systemText = anthropicRequest.system;
    } else if (Array.isArray(anthropicRequest.system)) {
      const textParts = anthropicRequest.system
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text);
      systemText = textParts.join("\n\n");
    }

    if (systemText.trim()) {
      openaiMessages.push({
        role: "system",
        content: systemText.trim(),
      });
    }
  }

  // Process Anthropic messages
  let i = 0;
  while (i < anthropicRequest.messages.length) {
    const msg = anthropicRequest.messages[i];

    if (msg.role === "user") {
      const openaiMessage = convertAnthropicUserMessage(msg);
      openaiMessages.push(openaiMessage);
    } else if (msg.role === "assistant") {
      const openaiMessage = convertAnthropicAssistantMessage(msg);
      openaiMessages.push(openaiMessage);

      // Check if next message contains tool results
      if (i + 1 < anthropicRequest.messages.length) {
        const nextMsg = anthropicRequest.messages[i + 1];
        if (
          nextMsg.role === "user" &&
          Array.isArray(nextMsg.content) &&
          nextMsg.content.some((block) => block.type === "tool_result")
        ) {
          // Process tool results
          i += 1; // Skip to tool result message
          const toolResults = convertAnthropicToolResults(nextMsg);
          openaiMessages.push(...toolResults);
        }
      }
    }

    i += 1;
  }

  // Build OpenAI request
  const openaiRequest: OpenAIRequest = {
    model: targetModel || mapAnthropicModelToOpenAI(anthropicRequest.model),
    messages: openaiMessages,
    max_tokens: Math.min(Math.max(anthropicRequest.max_tokens, 1), 8192),
    temperature: anthropicRequest.temperature,
    stream: anthropicRequest.stream,
  };

  // Add optional parameters
  if (anthropicRequest.stop_sequences) {
    openaiRequest.stop = anthropicRequest.stop_sequences;
  }
  if (anthropicRequest.top_p !== undefined) {
    openaiRequest.top_p = anthropicRequest.top_p;
  }

  // Convert tools
  if (anthropicRequest.tools) {
    const openaiTools = anthropicRequest.tools
      .filter((tool) => tool.name && tool.name.trim())
      .map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description || "",
          parameters: tool.input_schema,
        },
      }));

    if (openaiTools.length > 0) {
      openaiRequest.tools = openaiTools;
    }
  }

  // Convert tool choice
  if (anthropicRequest.tool_choice) {
    const choiceType = anthropicRequest.tool_choice.type;
    if (choiceType === "auto") {
      openaiRequest.tool_choice = "auto";
    } else if (choiceType === "any") {
      openaiRequest.tool_choice = "auto";
    } else if (
      choiceType === "tool" &&
      "name" in anthropicRequest.tool_choice &&
      anthropicRequest.tool_choice.name
    ) {
      openaiRequest.tool_choice = {
        type: "function",
        function: { name: anthropicRequest.tool_choice.name },
      };
    } else {
      openaiRequest.tool_choice = "auto";
    }
  }

  return openaiRequest;
}

function convertAnthropicUserMessage(msg: AnthropicMessage): OpenAIMessage {
  if (!msg.content) {
    return { role: "user", content: "" };
  }

  if (typeof msg.content === "string") {
    return { role: "user", content: msg.content };
  }

  // Handle multimodal content
  const openaiContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];
  for (const block of msg.content) {
    if (block.type === "text" && block.text) {
      openaiContent.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      // Convert Anthropic image format to OpenAI format
      if (
        block.source &&
        typeof block.source === "object" &&
        "type" in block.source &&
        block.source.type === "base64" &&
        "media_type" in block.source &&
        "data" in block.source
      ) {
        openaiContent.push({
          type: "image_url",
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        });
      }
    }
  }

  if (openaiContent.length === 1 && openaiContent[0].type === "text") {
    return { role: "user", content: openaiContent[0].text };
  }
  return { role: "user", content: openaiContent };
}

function convertAnthropicAssistantMessage(
  msg: AnthropicMessage
): OpenAIMessage {
  const textParts: string[] = [];
  const toolCalls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }> = [];

  if (!msg.content) {
    return { role: "assistant", content: null };
  }

  if (typeof msg.content === "string") {
    return { role: "assistant", content: msg.content };
  }

  for (const block of msg.content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "tool_use" && block.id && block.name) {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        },
      });
    }
  }

  const openaiMessage: OpenAIMessage = { role: "assistant", content: null };

  // Set content
  if (textParts.length > 0) {
    openaiMessage.content = textParts.join("");
  } else {
    openaiMessage.content = null;
  }

  // Set tool calls
  if (toolCalls.length > 0) {
    openaiMessage.tool_calls = toolCalls;
  }

  return openaiMessage;
}

function convertAnthropicToolResults(msg: AnthropicMessage): OpenAIMessage[] {
  const toolMessages: OpenAIMessage[] = [];

  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "tool_result") {
        const content = parseToolResultContent(block.content);
        toolMessages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content,
        });
      }
    }
  }

  return toolMessages;
}

function parseToolResultContent(content: unknown): string {
  if (content === null || content === undefined) {
    return "No content provided";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const resultParts = [];
    for (const item of content) {
      if (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "text"
      ) {
        resultParts.push((item as { text: string }).text || "");
      } else if (typeof item === "string") {
        resultParts.push(item);
      } else if (typeof item === "object" && item !== null) {
        if ("text" in item) {
          resultParts.push((item as { text: string }).text || "");
        } else {
          try {
            resultParts.push(JSON.stringify(item));
          } catch {
            resultParts.push(String(item));
          }
        }
      }
    }
    return resultParts.join("\n").trim();
  }

  if (typeof content === "object" && content !== null) {
    if ("type" in content && content.type === "text") {
      const textContent = content as { text?: string };
      return textContent.text || "";
    }
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }

  try {
    return String(content);
  } catch {
    return "Unparseable content";
  }
}

function mapAnthropicModelToOpenAI(model: string): string {
  // Map Anthropic model names to OpenAI compatible ones for Groq
  if (model.includes("claude-3-5-sonnet")) {
    return "llama-3.3-70b-versatile";
  }
  if (model.includes("claude-3-haiku")) {
    return "llama-3.1-8b-instant";
  }
  if (model.includes("claude-3-sonnet")) {
    return "llama-3.1-70b-versatile";
  }
  
  // Default to Kimi model
  return "moonshotai/kimi-k2-instruct";
}
