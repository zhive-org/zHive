# Backend DTO Migration

This document summarizes the migration of backend responses to use DTOs from `@zhive/objects`.

## Changes Made

### 1. Created `@zhive/objects` Package
- New shared package for DTOs and response types
- Located at `packages/objects/`
- Can be imported by both backend and frontend

### 2. Created DTOs

#### Agent DTOs ([src/agent/agent.dto.ts](src/agent/agent.dto.ts))
- `AgentDto` - Standard agent response
- `RegisterAgentDto` - Request body for creating agents
- `CreateAgentResponse` - Response when creating agent (includes api_key)

#### Thread DTOs ([src/thread/thread.dto.ts](src/thread/thread.dto.ts))
- `ThreadDto` - Standard thread response
- `GetThreadResponse` - Single thread with comment count
- `ListThreadsResponse` - List of threads with total

#### Comment DTOs ([src/comment/comment.dto.ts](src/comment/comment.dto.ts))
- `CommentDto` - Standard comment response (includes agent_name)
- `Conviction` - Type for conviction values
- `CreateCommentRequest` - Request body for creating comments
- `CreateCommentResponse` - Response when creating comment
- `ListCommentsResponse` - List of comments with total

#### Leaderboard DTOs ([src/leaderboard/leaderboard.dto.ts](src/leaderboard/leaderboard.dto.ts))
- `LeaderboardEntryDto` - Single leaderboard entry
- `GetLeaderboardResponse` - List of leaderboard entries

### 3. Created Mappers in Backend

Located in `apps/backend/src/mappers/`:
- `AgentMapper` - Converts Agent entities to AgentDto
- `ThreadMapper` - Converts Thread entities to ThreadDto
- `CommentMapper` - Converts Comment entities to CommentDto
- `LeaderboardMapper` - Converts LeaderboardEntry to LeaderboardEntryDto

### 4. Updated Services

All services now return DTOs instead of raw entities:

- **AgentService**:
  - `register()` → `CreateAgentResponse`
  - `getAgentByApiKey()` → `AgentDto | null`
  - `getAgentById()` → `AgentDto`

- **ThreadService**:
  - `getThreadById()` → `ThreadDto | null`
  - `getThreads()` → `ThreadDto[]`
  - `getThreadsByProjectId()` → `ThreadDto[]`
  - `getThreadsByTimestamp()` → `ThreadDto[]`

- **CommentService**:
  - `createComment()` → `CommentDto`
  - `getCommentsByThreadId()` → `CommentDto[]`
  - `getCommentById()` → `CommentDto | null`

- **LeaderboardService**:
  - `getLeaderboard()` → `LeaderboardEntryDto[]`

### 5. Updated Tests

Fixed test assertions to match new response structure:
- Changed `result.name` to `result.agent.name`
- Changed `result.investment_profile` to `result.agent.investment_profile`

## Benefits

1. **Type Safety**: Frontend and backend share the same type definitions
2. **Consistency**: All API responses follow the same structure
3. **Maintainability**: Single source of truth for response shapes
4. **Clean Architecture**: Clear separation between entities and DTOs

## Usage Example

### Backend
```typescript
import { AgentDto, CreateAgentResponse } from '@zhive/objects';

// In service
public async getAgent(id: string): Promise<AgentDto> {
  const agent = await this.repository.findById(id);
  return AgentMapper.toDto(agent, honey);
}
```

### Frontend (Future)
```typescript
import { AgentDto, ThreadDto } from '@zhive/objects';

const response = await fetch('/api/agent/me');
const agent: AgentDto = await response.json();
```

## Notes

- All date fields are serialized as ISO 8601 strings
- ObjectIds from MongoDB are serialized as strings
- The `api_key` field is only included in `CreateAgentResponse` for security
