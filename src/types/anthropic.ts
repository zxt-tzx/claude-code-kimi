export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string | Array<{ type: string; text: string }>;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[] | null;
}

interface AnthropicContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: unknown;
}

interface AnthropicToolChoice {
  type: "auto" | "any" | "tool";
  name?: string;
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicContent[];
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
  };
}
