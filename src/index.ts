import { config } from './config';
import { handleGroqRequest } from './providers/groq';
import { handleMoonshotRequest } from './providers/moonshot';

try {
  Bun.serve({
    port: config.port,
    async fetch(request) {
      const url = new URL(request.url);

      if (config.debug) {
        console.log(`${request.method} ${url.pathname}${url.search} [${config.provider}]`);
      }

      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      try {
        // Route to appropriate provider
        if (config.provider === 'groq') {
          return await handleGroqRequest(request, url);
        }
        return await handleMoonshotRequest(request, url);
      } catch (error) {
        console.error('Proxy error:', error);
        return new Response('Proxy Error', { status: 500 });
      }
    },
  });

  console.log(`Claude Code Proxy running on http://localhost:${config.port}`);
  if (config.provider === 'groq') {
    console.log(`Using provider: Groq (${config.groq.baseUrl})`);
    console.log(`Groq API Key configured: ${config.groq.apiKey ? 'Yes' : 'No'}`);
  } else {
    console.log(`Using provider: Moonshot (${config.moonshot.baseUrl})`);
    console.log(`Moonshot API Key configured: ${config.moonshot.apiKey ? 'Yes' : 'No'}`);
  }
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.log(`Port ${config.port} is already in use - assuming proxy is already running`);
    process.exit(0);
  } else {
    console.error('Failed to start proxy:', error);
    process.exit(1);
  }
}
