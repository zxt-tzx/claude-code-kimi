export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: "auto" | "none" | OpenAIToolChoice;
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIContent[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
  };
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}

interface OpenAIToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens: number;
    };
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens: number;
    };
  };
}
