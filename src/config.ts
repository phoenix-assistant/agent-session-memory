export interface MemoryConfig {
  /** What categories to remember */
  categories: MemoryCategory[];
  /** Max days to retain memories */
  retentionDays: number;
  /** Max memories per agent */
  maxMemories: number;
  /** Importance threshold below which memories are pruned (0-1) */
  pruneThreshold: number;
  /** Decay half-life in days */
  decayHalfLifeDays: number;
  /** Boost multiplier when a memory is accessed */
  accessBoost: number;
}

export type MemoryCategory = "fact" | "decision" | "preference" | "instruction" | "context";

export interface Memory {
  id: string;
  agentId: string;
  sessionId: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  effectiveImportance?: number;
  accessCount: number;
  createdAt: number;
  lastAccessedAt: number;
}

export const DEFAULT_CONFIG: MemoryConfig = {
  categories: ["fact", "decision", "preference", "instruction", "context"],
  retentionDays: 90,
  maxMemories: 1000,
  pruneThreshold: 0.05,
  decayHalfLifeDays: 14,
  accessBoost: 1.3,
};
