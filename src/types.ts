export type MemoryCategory = "decision" | "code_ref" | "tool_call" | "fact" | "preference" | "instruction" | "context";

export interface Memory {
  id: string;
  agentId: string;
  sessionId: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  keywords: string[];
  accessCount: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface CompressedSession {
  sessionId: string;
  agentId: string;
  memories: Memory[];
  summary: string;
  compressedAt: number;
}

export interface MemoryConfig {
  categories: MemoryCategory[];
  retentionDays: number;
  maxMemories: number;
  pruneThreshold: number;
  decayHalfLifeDays: number;
  accessBoost: number;
  storagePath: string;
}

export const DEFAULT_CONFIG: MemoryConfig = {
  categories: ["decision", "code_ref", "tool_call", "fact", "preference", "instruction", "context"],
  retentionDays: 90,
  maxMemories: 1000,
  pruneThreshold: 0.05,
  decayHalfLifeDays: 14,
  accessBoost: 1.3,
  storagePath: ".agent-memory",
};
