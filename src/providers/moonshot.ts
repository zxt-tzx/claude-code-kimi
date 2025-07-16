import { config } from "../config";

export async function handleMoonshotRequest(
  request: Request,
  url: URL
): Promise<Response> {
  // Build the target URL
  const targetUrl = new URL(
    config.moonshot.baseUrl + url.pathname + url.search
  );

  // Clone the request with updated headers
  const headers = new Headers(request.headers);

  // Replace the authorization header with Moonshot API key
  if (config.moonshot.apiKey) {
    headers.set("Authorization", `Bearer ${config.moonshot.apiKey}`);
  }

  // Set the correct host header
  headers.set("Host", new URL(config.moonshot.baseUrl).host);

  // Forward the request to Moonshot
  if (config.debug) {
    console.log(`Forwarding to: ${targetUrl.toString()}`);
  }

  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
  });

  if (config.debug) {
    console.log(`Response: ${response.status} ${response.statusText}`);
  }

  // Return the response with CORS headers for browser compatibility
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  responseHeaders.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
