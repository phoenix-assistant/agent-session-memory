import { MemoryConfig, DEFAULT_CONFIG, Memory, CompressedSession } from "./types.js";
import { StorageEngine } from "./storage.js";
import { DecayManager } from "./decay.js";
import { extractMemories, compressSession } from "./compressor.js";

/**
 * High-level API for session memory management.
 */
export class SessionHook {
  private storage: StorageEngine;
  private decay: DecayManager;
  private config: MemoryConfig;

  constructor(storage: StorageEngine, config: MemoryConfig = DEFAULT_CONFIG) {
    this.storage = storage;
    this.config = config;
    this.decay = new DecayManager(storage, config);
  }

  /** Called at session start — returns relevant memories for context injection. */
  onSessionStart(agentId: string, opts?: { limit?: number; minImportance?: number }): Memory[] {
    this.decay.decay(agentId);
    const memories = this.storage.getByAgent(agentId, {
      minImportance: opts?.minImportance ?? this.config.pruneThreshold,
      limit: opts?.limit ?? 20,
    });
    for (const m of memories) {
      this.storage.recordAccess(agentId, m.id);
    }
    return memories;
  }

  /** Called at session end — extracts and stores memories from conversation. */
  onSessionEnd(agentId: string, sessionId: string, conversationText: string): Memory[] {
    const extracted = extractMemories(conversationText);
    const stored: Memory[] = [];
    for (const e of extracted) {
      if (this.config.categories.includes(e.category)) {
        stored.push(this.storage.insert(agentId, sessionId, e.category, e.content, e.importance, e.keywords));
      }
    }
    return stored;
  }
}

/**
 * Top-level API functions.
 */
export function compress(text: string, agentId: string = "default", sessionId?: string, storagePath?: string): CompressedSession {
  const sid = sessionId || `session-${Date.now()}`;
  const storage = new StorageEngine(storagePath || DEFAULT_CONFIG.storagePath);
  const hook = new SessionHook(storage);
  const memories = hook.onSessionEnd(agentId, sid, text);
  const summary = compressSession(text);
  const session: CompressedSession = { sessionId: sid, agentId, memories, summary, compressedAt: Date.now() };
  storage.storeCompressedSession(session);
  return session;
}

export function recall(query: string, agentId: string = "default", storagePath?: string): Memory[] {
  const storage = new StorageEngine(storagePath || DEFAULT_CONFIG.storagePath);
  return storage.search(agentId, query);
}

export function store(agentId: string, sessionId: string, category: string, content: string, importance: number = 0.5, storagePath?: string): Memory {
  const storage = new StorageEngine(storagePath || DEFAULT_CONFIG.storagePath);
  return storage.insert(agentId, sessionId, category as any, content, importance);
}
