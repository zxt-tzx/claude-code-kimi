#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Verify we're in the right place
if [[ ! -f "package.json" ]]; then
    # For global npm installs, find the actual package directory
    NPM_GLOBAL_PATH="$(npm root -g 2>/dev/null)"
    if [[ -n "$NPM_GLOBAL_PATH" ]]; then
        PROJECT_DIR="$NPM_GLOBAL_PATH/claude-code-kimi"
        if [[ -f "$PROJECT_DIR/package.json" ]]; then
            cd "$PROJECT_DIR"
        else
            echo "Error: Could not locate claude-code-kimi installation"
            exit 1
        fi
    else
        echo "Error: Could not determine npm global path"
        exit 1
    fi
fi

# Check for .env file in the claude-code-kimi package directory
echo "Looking for .env file at: $PROJECT_DIR/.env"
if [[ -f "$PROJECT_DIR/.env" ]]; then
    echo "Loading environment variables from $PROJECT_DIR/.env"
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
else
    echo "No .env file found at $PROJECT_DIR/.env"
fi

# Prompt user to select AI provider
echo "Select AI provider:"
echo "1) Moonshot AI (moonshotai/kimi-k2-instruct)"
echo "2) Groq (moonshotai/kimi-k2-instruct)"
echo -n "Choice [1-2]: "
read -r choice

# Validate choice and set provider
case $choice in
1)
    export PROVIDER="moonshot"
    if [[ -z "$MOONSHOT_API_KEY" ]]; then
        echo "Error: MOONSHOT_API_KEY environment variable is required for Moonshot AI"
        echo "Please set it with: export MOONSHOT_API_KEY=your_api_key"
        echo "Or create a .env file in the claude-code-kimi package directory with:"
        echo "MOONSHOT_API_KEY=your_api_key"
        exit 1
    fi
    echo "✓ Using Moonshot AI"
    ;;
2)
    export PROVIDER="groq"
    if [[ -z "$GROQ_API_KEY" ]]; then
        echo "Error: GROQ_API_KEY environment variable is required for Groq"
        echo "Please set it with: export GROQ_API_KEY=your_api_key"
        echo "Or create a .env file in the claude-code-kimi package directory with:"
        echo "GROQ_API_KEY=your_api_key"
        exit 1
    fi
    echo "✓ Using Groq"
    ;;
*)
    echo "Error: Invalid choice. Please select 1 or 2."
    exit 1
    ;;
esac

# Start the proxy server in the background
echo "Starting proxy server..."
bun run start &
PROXY_PID=$!

# Wait for proxy to start
sleep 2

# Set environment variables for Claude Code
export ANTHROPIC_BASE_URL="http://localhost:8421"
export ANTHROPIC_AUTH_TOKEN="dummy"

# Start Claude Code with the provided arguments
echo "Starting Claude Code..."
claude --dangerously-skip-permissions "$@"

# Clean up: kill the proxy when Claude Code exits
echo "Shutting down proxy..."
kill $PROXY_PID 2>/dev/null
