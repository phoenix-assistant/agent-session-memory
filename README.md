# agent-session-memory

Session memory compression and replay plugin for OpenClaw. Extracts facts, decisions, and preferences from conversations, stores them in SQLite, and replays relevant memories at session start.

## Install

```bash
npm install agent-session-memory
```

## Quick Start

```typescript
import { StorageEngine, SessionHook } from "agent-session-memory";

const storage = new StorageEngine("./memories.db");
const hook = new SessionHook(storage);

// At session end — extract and store memories
hook.onSessionEnd("agent-1", "session-abc", conversationText);

// At session start — inject relevant memories
const memories = hook.onSessionStart("agent-1");
```

## API

### `StorageEngine`

SQLite-backed storage with WAL mode.

```typescript
new StorageEngine(dbPath?: string) // default: in-memory
```

| Method | Description |
|--------|-------------|
| `insert(agentId, sessionId, category, content, importance)` | Store a memory |
| `getByAgent(agentId, opts?)` | Get memories by agent (filter by minImportance, limit) |
| `getBySession(sessionId)` | Get memories from a session |
| `search(agentId, keyword)` | Full-text keyword search |
| `getByTimeRange(agentId, from, to)` | Query by timestamp range |
| `recordAccess(id)` | Bump access count (boosts importance) |
| `delete(id)` | Delete a memory |

### `SessionHook`

Lifecycle hooks for session start/end.

```typescript
new SessionHook(storage, config?)
```

| Method | Description |
|--------|-------------|
| `onSessionStart(agentId, opts?)` | Returns relevant memories, runs decay |
| `onSessionEnd(agentId, sessionId, text)` | Extracts and stores memories from conversation |

### `extractMemories(text)`

Extracts structured memories from conversation text. Returns `{ category, content, importance }[]`.

Categories: `fact`, `decision`, `preference`, `instruction`, `context`.

### `DecayManager`

Exponential time-decay with access-boost. Prunes memories below threshold.

```typescript
new DecayManager(storage, config?)
decay(agentId): number // returns count pruned
```

### `MemoryConfig`

```typescript
{
  categories: MemoryCategory[];  // what to remember
  retentionDays: number;         // max age (default: 90)
  maxMemories: number;           // per agent (default: 1000)
  pruneThreshold: number;        // min importance (default: 0.05)
  decayHalfLifeDays: number;     // decay speed (default: 14)
  accessBoost: number;           // per access (default: 1.3)
}
```

## License

MIT
