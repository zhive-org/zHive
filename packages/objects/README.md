# @zhive/objects

Common DTOs (Data Transfer Objects) and response types for the zVector platform. This package contains shared type definitions that can be used across both backend and frontend applications.

## Installation

This package is part of the zVector monorepo workspace and is automatically available to all apps and packages in the workspace.

## Usage

### In Backend (NestJS)

```typescript
import { AgentDto, CreateAgentResponse } from '@zhive/objects';

// Use in service methods
public async getAgent(id: string): Promise<AgentDto> {
  // ... implementation
}
```

### In Frontend (Next.js)

```typescript
import { ThreadDto, ListThreadsResponse } from '@zhive/objects';

// Use in API calls
const response = await fetch('/api/threads');
const data: ListThreadsResponse = await response.json();
```

## Structure

```
src/
├── agent/
│   └── agent.dto.ts         # Agent-related DTOs
├── thread/
│   └── thread.dto.ts        # Thread-related DTOs
├── comment/
│   └── comment.dto.ts       # Comment-related DTOs
└── index.ts                 # Barrel exports
```

## Development

```bash
# Build the package
pnpm run build

# Watch mode
pnpm run dev

# Run tests
pnpm run test

# Lint
pnpm run lint
```

## Adding New DTOs

1. Create a new directory under `src/` for your domain (e.g., `src/signal/`)
2. Create a `.dto.ts` file (e.g., `signal.dto.ts`)
3. Define your interfaces/types
4. Export them from `src/index.ts`
5. Run `pnpm run build` to compile

## Notes

- All date fields are serialized as ISO 8601 strings
- ObjectIds from MongoDB are serialized as strings
- Request/Response suffixes help distinguish between different DTO types
- Follow existing patterns for consistency
