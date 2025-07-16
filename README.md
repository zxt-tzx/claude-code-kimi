# claude-code-kimi

A simple proxy to allow Claude Code to work with Kimi K2 and other models.

## Setup

1. Install (make sure you have [bun installed](https://bun.com/docs/installation)).

   ```bash
   bun install
   ```

2. Configure API key:

   ```bash
   cp .env.example .env
   # Edit .env and add: MOONSHOT_API_KEY=your_api_key_here
   ```

3. Install globally:

   ```bash
   npm install -g .
   ```

## Usage

Run Claude Code from any directory:

```bash
cck
```

That's it! The proxy starts automatically and Claude Code runs with the correct configuration.

## How it works

The proxy:

1. Accepts Anthropic API requests from Claude Code
2. Replaces the authorization header with your Moonshot AI API key
3. Forwards requests to Moonshot's Anthropic-compatible endpoint
4. Returns responses back to Claude Code

## Configuration

The API key is stored in the `.env` file where you installed the proxy. You can modify other settings there if needed:

- `MOONSHOT_API_KEY`: Your Moonshot AI API key (required)
- `PORT`: Proxy server port (default: 8080)
- `DEBUG`: Enable debug logging (default: false)
