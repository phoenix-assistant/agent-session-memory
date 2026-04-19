import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { Memory, MemoryCategory, CompressedSession } from "./types.js";

/**
 * JSON-file-based storage engine — zero native dependencies.
 * Stores one JSON file per agent in the configured directory.
 */
export class StorageEngine {
  private dir: string;

  constructor(storagePath: string = ".agent-memory") {
    this.dir = storagePath;
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  private agentFile(agentId: string): string {
    return join(this.dir, `${agentId}.json`);
  }

  private load(agentId: string): Memory[] {
    const f = this.agentFile(agentId);
    if (!existsSync(f)) return [];
    return JSON.parse(readFileSync(f, "utf-8"));
  }

  private save(agentId: string, memories: Memory[]): void {
    writeFileSync(this.agentFile(agentId), JSON.stringify(memories, null, 2));
  }

  insert(agentId: string, sessionId: string, category: MemoryCategory, content: string, importance: number, keywords: string[] = []): Memory {
    const memories = this.load(agentId);
    const now = Date.now();
    const mem: Memory = {
      id: randomUUID(),
      agentId,
      sessionId,
      category,
      content,
      importance,
      keywords,
      accessCount: 0,
      createdAt: now,
      lastAccessedAt: now,
    };
    memories.push(mem);
    this.save(agentId, memories);
    return mem;
  }

  getByAgent(agentId: string, opts?: { minImportance?: number; limit?: number }): Memory[] {
    let mems = this.load(agentId);
    if (opts?.minImportance !== undefined) {
      mems = mems.filter(m => m.importance >= opts.minImportance!);
    }
    mems.sort((a, b) => b.importance - a.importance);
    if (opts?.limit) mems = mems.slice(0, opts.limit);
    return mems;
  }

  getBySession(agentId: string, sessionId: string): Memory[] {
    return this.load(agentId).filter(m => m.sessionId === sessionId);
  }

  search(agentId: string, keyword: string): Memory[] {
    const kw = keyword.toLowerCase();
    return this.load(agentId)
      .filter(m => m.content.toLowerCase().includes(kw) || m.keywords.some(k => k.includes(kw)))
      .sort((a, b) => b.importance - a.importance);
  }

  getByTimeRange(agentId: string, from: number, to: number): Memory[] {
    return this.load(agentId).filter(m => m.createdAt >= from && m.createdAt <= to);
  }

  recordAccess(agentId: string, id: string): void {
    const mems = this.load(agentId);
    const mem = mems.find(m => m.id === id);
    if (mem) {
      mem.accessCount++;
      mem.lastAccessedAt = Date.now();
      this.save(agentId, mems);
    }
  }

  updateImportance(agentId: string, id: string, importance: number): void {
    const mems = this.load(agentId);
    const mem = mems.find(m => m.id === id);
    if (mem) {
      mem.importance = importance;
      this.save(agentId, mems);
    }
  }

  delete(agentId: string, id: string): void {
    const mems = this.load(agentId).filter(m => m.id !== id);
    this.save(agentId, mems);
  }

  deleteByAgent(agentId: string): void {
    this.save(agentId, []);
  }

  all(agentId: string): Memory[] {
    return this.load(agentId).sort((a, b) => b.createdAt - a.createdAt);
  }

  count(agentId: string): number {
    return this.load(agentId).length;
  }

  // Session compression storage
  storeCompressedSession(session: CompressedSession): void {
    const f = join(this.dir, `session-${session.sessionId}.json`);
    writeFileSync(f, JSON.stringify(session, null, 2));
  }

  loadCompressedSession(sessionId: string): CompressedSession | null {
    const f = join(this.dir, `session-${sessionId}.json`);
    if (!existsSync(f)) return null;
    return JSON.parse(readFileSync(f, "utf-8"));
  }
}
