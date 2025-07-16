export interface ProxyConfig {
  port: number;
  debug: boolean;
  provider: 'moonshot' | 'groq';
  moonshot: {
    baseUrl: string;
    apiKey: string;
  };
  groq: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
}

export const config: ProxyConfig = {
  port: Number.parseInt(process.env.PORT || '8421', 10), // Use unique port to avoid conflicts
  debug: process.env.DEBUG === 'true',
  provider: (process.env.PROVIDER as 'moonshot' | 'groq') || 'moonshot',
  moonshot: {
    baseUrl:
      process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/anthropic',
    apiKey: process.env.MOONSHOT_API_KEY || '',
  },
  groq: {
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'moonshotai/kimi-k2-instruct',
  },
};
