# CLAUDE.md

## About

This is a simple proxy to allow Claude Code to work with Kimi K2.

## Technology

### Tech Stack

Runs locally using Bun.

## Tips

- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')
- **NEVER use `any` type** - Always use proper TypeScript types. Import types from libraries when available. Only use `unknown` and `any` in exceptional cases where justified by other examples in the codebase.
- **Prefer shadcn/ui components** - Use components from `@/components/ui/` instead of plain HTML elements (e.g., use `Button` component instead of `<button>`)
- Use Context7 MCP to get code snippets to understand library APIs (see `.mcp.json`)
- Use exhaustive switch patterns with destructuring for better type safety:

  ```typescript
  const { role } = message; // must be destructured for satisfies to work
  switch (role) {
    case "system":
      // handle system
      break;
    case "user":
      // handle user
      break;
    case "assistant":
      // handle assistant
      break;
    case "tool":
      // handle tool
      break;
    default:
      role satisfies never;
      throw new Error(`Unhandled role: ${role}`);
  }
  ```

- Don't use immediately invoked function expressions (IIFEs) directly in return objects. Calculate values beforehand for better readability and debugging.
- Prefer destructured object parameters over plain strings for function arguments to prevent passing wrong values:
- Avoid using return types in functions, prefer type inference instead

## Documentation guidelines

- Follow markdown best practices - use proper headings instead of bold text for structure
- **IMPORTANT** Don't do the thing where you write bullet points where the first few words are bolded.
