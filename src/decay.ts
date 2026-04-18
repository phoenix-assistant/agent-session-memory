import { MemoryConfig, DEFAULT_CONFIG } from "./config.js";
import { StorageEngine } from "./storage.js";

export class DecayManager {
  constructor(
    private storage: StorageEngine,
    private config: MemoryConfig = DEFAULT_CONFIG
  ) {}

  /** Apply time-decay to all memories for an agent. Returns number pruned. */
  decay(agentId: string): number {
    const memories = this.storage.all(agentId);
    const now = Date.now();
    let pruned = 0;

    for (const mem of memories) {
      const ageDays = (now - mem.createdAt) / (1000 * 60 * 60 * 24);
      // Exponential decay: importance * 0.5^(age/halfLife)
      const decayFactor = Math.pow(0.5, ageDays / this.config.decayHalfLifeDays);
      // Access boost: multiply by boost^accessCount (capped)
      const boostFactor = Math.pow(this.config.accessBoost, Math.min(mem.accessCount, 10));
      const effective = mem.importance * decayFactor * boostFactor;

      if (effective < this.config.pruneThreshold) {
        this.storage.delete(mem.id);
        pruned++;
      } else {
        this.storage.updateImportance(mem.id, effective);
      }
    }

    // Enforce max memories
    const remaining = this.storage.all(agentId);
    if (remaining.length > this.config.maxMemories) {
      const toRemove = remaining.slice(this.config.maxMemories);
      for (const m of toRemove) {
        this.storage.delete(m.id);
        pruned++;
      }
    }

    return pruned;
  }
}
