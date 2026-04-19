# agent-session-memory

[![npm version](https://img.shields.io/npm/v/@phoenixaihub/agent-session-memory)](https://www.npmjs.com/package/@phoenixaihub/agent-session-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-24%20passing-brightgreen)]()

Session memory compression and replay plugin for [OpenClaw](https://openclaw.dev) — persist context across agent sessions.

Applies the **claude-mem pattern**: compress session transcripts into structured memory, store in a lightweight JSON-file DB, and replay relevant context at session start. Zero native dependencies.

## Install

```bash
npm install @phoenixaihub/agent-session-memory
```

## CLI

```bash
# Compress a session transcript into structured memories
agent-session-memory compress session.txt --agent my-agent

# Recall memories by keyword
agent-session-memory recall --query "database" --agent my-agent
```

## API

```typescript
import { compress, recall, store, SessionHook, StorageEngine } from "@phoenixaihub/agent-session-memory";

// Compress a session transcript
const session = compress(transcriptText, "agent-id", "session-123");
// => { sessionId, memories, summary, compressedAt }

// Recall memories by keyword
const memories = recall("TypeScript", "agent-id");

// Store a single memory
store("agent-id", "session-1", "decision", "Use PostgreSQL for storage", 0.8);

// Full lifecycle via SessionHook
const storage = new StorageEngine(".agent-memory");
const hook = new SessionHook(storage);

// Session start: get relevant context
const context = hook.onSessionStart("agent-id");

// Session end: extract and persist memories
const extracted = hook.onSessionEnd("agent-id", "session-123", conversationText);
```

## Architecture

```
┌─────────────────┐
│  Session Text    │
└────────┬────────┘
         │
    ┌────▼────┐
    │ TF-IDF  │  Keyword extraction (zero-dep)
    │ Engine  │
    └────┬────┘
         │
  ┌──────▼──────┐
  │  Compressor  │  Pattern matching + entity extraction
  │              │  Categories: decision, fact, preference,
  │              │  instruction, tool_call, code_ref, context
  └──────┬──────┘
         │
   ┌─────▼─────┐
   │  Storage   │  JSON files per agent (zero native deps)
   │  Engine    │
   └─────┬─────┘
         │
   ┌─────▼─────┐
   │   Decay    │  Time-decay + access-boost
   │  Manager   │  Auto-prune low-importance memories
   └───────────┘
```

### Memory Categories

| Category | Triggers | Importance |
|----------|----------|------------|
| `decision` | "decided", "agreed", "will go with" | 0.8 |
| `instruction` | "always", "never", "remember to" | 0.9 |
| `fact` | "my name is", "I work at" | 0.7 |
| `preference` | "prefer", "like", "hate" | 0.6 |
| `code_ref` | file paths, "function", "module" | 0.5-0.6 |
| `tool_call` | "called", "invoked", "ran" | 0.5 |
| `context` | fallback for unstructured text | 0.3 |

### Decay Model

Memories decay exponentially over time with a configurable half-life (default: 14 days). Frequently accessed memories get boosted. Memories below the prune threshold are automatically removed.

```
effective_importance = base_importance × 0.5^(age/halfLife) × boost^accessCount
```

## Configuration

```typescript
import { DEFAULT_CONFIG } from "@phoenixaihub/agent-session-memory";

// Defaults:
{
  retentionDays: 90,
  maxMemories: 1000,
  pruneThreshold: 0.05,
  decayHalfLifeDays: 14,
  accessBoost: 1.3,
  storagePath: ".agent-memory",
}
```

## License

MIT
