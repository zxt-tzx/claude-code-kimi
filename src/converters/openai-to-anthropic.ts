import type { AnthropicRequest, AnthropicResponse } from '../types/anthropic';
import type { OpenAIResponse, OpenAIStreamChunk } from '../types/openai';

export function convertOpenAIToAnthropic(
  openaiResponse: OpenAIResponse,
  originalRequest: AnthropicRequest
): AnthropicResponse {
  const choices = openaiResponse.choices;
  if (!choices || choices.length === 0) {
    throw new Error('No choices in OpenAI response');
  }

  const choice = choices[0];
  const message = choice.message;

  // Build Anthropic content blocks
  const contentBlocks = [];

  // Add text content
  const textContent = message.content;
  if (textContent !== null && textContent !== undefined) {
    contentBlocks.push({ type: 'text', text: textContent });
  }

  // Add tool calls
  const toolCalls = message.tool_calls || [];
  for (const toolCall of toolCalls) {
    if (toolCall.type === 'function') {
      const functionData = toolCall.function;
      let args;
      try {
        args = JSON.parse(functionData.arguments || '{}');
      } catch {
        args = { raw_arguments: functionData.arguments || '' };
      }

      contentBlocks.push({
        type: 'tool_use',
        id: toolCall.id,
        name: functionData.name,
        input: args,
      });
    }
  }

  // Ensure at least one content block
  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: 'text', text: '' });
  }

  // Map finish reason
  const finishReason = choice.finish_reason;
  const stopReason =
    {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
      content_filter: 'end_turn',
    }[finishReason] || 'end_turn';

  // Build Anthropic response
  const anthropicResponse: AnthropicResponse = {
    id: openaiResponse.id,
    type: 'message',
    role: 'assistant',
    model: originalRequest.model,
    content: contentBlocks,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openaiResponse.usage?.prompt_tokens || 0,
      output_tokens: openaiResponse.usage?.completion_tokens || 0,
      cache_read_input_tokens:
        openaiResponse.usage?.prompt_tokens_details?.cached_tokens || 0,
    },
  };

  return anthropicResponse;
}

export async function* convertOpenAIStreamToAnthropic(
  openaiStream: AsyncIterable<string>,
  originalRequest: AnthropicRequest
): AsyncGenerator<string> {
  const messageId = `msg_${generateId()}`;

  // Send initial SSE events
  yield `event: message_start\ndata: ${JSON.stringify({
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      model: originalRequest.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  })}\n\n`;

  yield `event: content_block_start\ndata: ${JSON.stringify({
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  })}\n\n`;

  yield `event: ping\ndata: ${JSON.stringify({ type: 'ping' })}\n\n`;

  // Process streaming chunks
  const textBlockIndex = 0;
  let toolBlockCounter = 0;
  const currentToolCalls: Record<
    number,
    {
      id: string | null;
      name: string | null;
      argsBuffer: string;
      jsonSent: boolean;
      claudeIndex: number | null;
      started: boolean;
    }
  > = {};
  let finalStopReason = 'end_turn';
  let usageData = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
  };

  try {
    for await (const line of openaiStream) {
      if (line.trim() && line.startsWith('data: ')) {
        const chunkData = line.slice(6);
        if (chunkData.trim() === '[DONE]') {
          break;
        }

        let chunk: OpenAIStreamChunk;
        try {
          chunk = JSON.parse(chunkData);
        } catch {
          continue;
        }

        // Extract usage if present
        if (chunk.usage) {
          usageData = {
            input_tokens: chunk.usage.prompt_tokens,
            output_tokens: chunk.usage.completion_tokens,
            cache_read_input_tokens:
              chunk.usage.prompt_tokens_details?.cached_tokens || 0,
          };
        }

        const choices = chunk.choices;
        if (!choices || choices.length === 0) {
          continue;
        }

        const choice = choices[0];
        const delta = choice.delta;
        const finishReason = choice.finish_reason;

        // Handle text delta
        if (delta && delta.content !== undefined && delta.content !== null) {
          yield `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: textBlockIndex,
            delta: { type: 'text_delta', text: delta.content },
          })}\n\n`;
        }

        // Handle tool call deltas
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const tcIndex = tcDelta.index || 0;

            // Initialize tool call tracking
            if (!(tcIndex in currentToolCalls)) {
              currentToolCalls[tcIndex] = {
                id: null,
                name: null,
                argsBuffer: '',
                jsonSent: false,
                claudeIndex: null,
                started: false,
              };
            }

            const toolCall = currentToolCalls[tcIndex];

            // Update tool call ID
            if (tcDelta.id) {
              toolCall.id = tcDelta.id;
            }

            // Update function name
            if (tcDelta.function?.name) {
              toolCall.name = tcDelta.function.name;
            }

            // Start content block when we have complete initial data
            if (toolCall.id && toolCall.name && !toolCall.started) {
              toolBlockCounter += 1;
              const claudeIndex = textBlockIndex + toolBlockCounter;
              toolCall.claudeIndex = claudeIndex;
              toolCall.started = true;

              yield `event: content_block_start\ndata: ${JSON.stringify({
                type: 'content_block_start',
                index: claudeIndex,
                content_block: {
                  type: 'tool_use',
                  id: toolCall.id,
                  name: toolCall.name,
                  input: {},
                },
              })}\n\n`;
            }

            // Handle function arguments
            if (
              tcDelta.function?.arguments &&
              toolCall.started &&
              tcDelta.function.arguments !== null
            ) {
              toolCall.argsBuffer += tcDelta.function.arguments;

              // Try to parse complete JSON and send delta when valid
              try {
                JSON.parse(toolCall.argsBuffer);
                if (!toolCall.jsonSent) {
                  yield `event: content_block_delta\ndata: ${JSON.stringify({
                    type: 'content_block_delta',
                    index: toolCall.claudeIndex,
                    delta: {
                      type: 'input_json_delta',
                      partial_json: toolCall.argsBuffer,
                    },
                  })}\n\n`;
                  toolCall.jsonSent = true;
                }
              } catch {
                // JSON incomplete, continue accumulating
              }
            }
          }
        }

        // Handle finish reason
        if (finishReason) {
          if (finishReason === 'length') {
            finalStopReason = 'max_tokens';
          } else if (finishReason === 'tool_calls') {
            finalStopReason = 'tool_use';
          } else if (finishReason === 'stop') {
            finalStopReason = 'end_turn';
          } else {
            finalStopReason = 'end_turn';
          }
        }
      }
    }
  } catch (error) {
    const errorEvent = {
      type: 'error',
      error: {
        type: 'api_error',
        message: `Streaming error: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
    yield `event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`;
    return;
  }

  // Send final SSE events
  yield `event: content_block_stop\ndata: ${JSON.stringify({
    type: 'content_block_stop',
    index: textBlockIndex,
  })}\n\n`;

  for (const toolData of Object.values(currentToolCalls)) {
    if (toolData.started && toolData.claudeIndex !== null) {
      yield `event: content_block_stop\ndata: ${JSON.stringify({
        type: 'content_block_stop',
        index: toolData.claudeIndex,
      })}\n\n`;
    }
  }

  yield `event: message_delta\ndata: ${JSON.stringify({
    type: 'message_delta',
    delta: { stop_reason: finalStopReason, stop_sequence: null },
    usage: usageData,
  })}\n\n`;

  yield `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`;
}

function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
