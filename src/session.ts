import { MemoryConfig, DEFAULT_CONFIG, Memory } from "./config.js";
import { StorageEngine } from "./storage.js";
import { DecayManager } from "./decay.js";
import { extractMemories } from "./compressor.js";

export class SessionHook {
  private storage: StorageEngine;
  private decay: DecayManager;
  private config: MemoryConfig;

  constructor(storage: StorageEngine, config: MemoryConfig = DEFAULT_CONFIG) {
    this.storage = storage;
    this.config = config;
    this.decay = new DecayManager(storage, config);
  }

  /** Called at session start. Returns relevant memories for context injection. */
  onSessionStart(agentId: string, opts?: { limit?: number; minImportance?: number }): Memory[] {
    // Run decay first
    this.decay.decay(agentId);
    // Fetch top memories
    const memories = this.storage.getByAgent(agentId, {
      minImportance: opts?.minImportance ?? this.config.pruneThreshold,
      limit: opts?.limit ?? 20,
    });
    // Record access
    for (const m of memories) {
      this.storage.recordAccess(m.id);
    }
    return memories;
  }

  /** Called at session end. Extracts and stores memories from conversation. */
  onSessionEnd(agentId: string, sessionId: string, conversationText: string): Memory[] {
    const extracted = extractMemories(conversationText);
    const stored: Memory[] = [];
    for (const e of extracted) {
      if (this.config.categories.includes(e.category)) {
        stored.push(this.storage.insert(agentId, sessionId, e.category, e.content, e.importance));
      }
    }
    return stored;
  }
}
