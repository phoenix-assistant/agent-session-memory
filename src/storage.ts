import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { Memory, MemoryCategory } from "./config.js";

export class StorageEngine {
  private db: Database.Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL NOT NULL,
        access_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_created ON memories(created_at);
    `);
  }

  insert(agentId: string, sessionId: string, category: MemoryCategory, content: string, importance: number): Memory {
    const now = Date.now();
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO memories (id, agent_id, session_id, category, content, importance, access_count, created_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, agentId, sessionId, category, content, importance, now, now);
    return { id, agentId, sessionId, category, content, importance, accessCount: 0, createdAt: now, lastAccessedAt: now };
  }

  getByAgent(agentId: string, opts?: { minImportance?: number; limit?: number }): Memory[] {
    let sql = `SELECT * FROM memories WHERE agent_id = ?`;
    const params: unknown[] = [agentId];
    if (opts?.minImportance !== undefined) {
      sql += ` AND importance >= ?`;
      params.push(opts.minImportance);
    }
    sql += ` ORDER BY importance DESC`;
    if (opts?.limit) { sql += ` LIMIT ?`; params.push(opts.limit); }
    return this.db.prepare(sql).all(...params).map(rowToMemory);
  }

  getBySession(sessionId: string): Memory[] {
    return this.db.prepare(`SELECT * FROM memories WHERE session_id = ?`).all(sessionId).map(rowToMemory);
  }

  search(agentId: string, keyword: string): Memory[] {
    return this.db.prepare(`SELECT * FROM memories WHERE agent_id = ? AND content LIKE ? ORDER BY importance DESC`)
      .all(agentId, `%${keyword}%`).map(rowToMemory);
  }

  getByTimeRange(agentId: string, from: number, to: number): Memory[] {
    return this.db.prepare(`SELECT * FROM memories WHERE agent_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC`)
      .all(agentId, from, to).map(rowToMemory);
  }

  recordAccess(id: string): void {
    this.db.prepare(`UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`).run(Date.now(), id);
  }

  updateImportance(id: string, importance: number): void {
    this.db.prepare(`UPDATE memories SET importance = ? WHERE id = ?`).run(importance, id);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
  }

  deleteByAgent(agentId: string): void {
    this.db.prepare(`DELETE FROM memories WHERE agent_id = ?`).run(agentId);
  }

  all(agentId: string): Memory[] {
    return this.db.prepare(`SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at DESC`).all(agentId).map(rowToMemory);
  }

  count(agentId: string): number {
    return (this.db.prepare(`SELECT COUNT(*) as c FROM memories WHERE agent_id = ?`).get(agentId) as { c: number }).c;
  }

  close(): void {
    this.db.close();
  }
}

function rowToMemory(row: any): Memory {
  return {
    id: row.id,
    agentId: row.agent_id,
    sessionId: row.session_id,
    category: row.category,
    content: row.content,
    importance: row.importance,
    accessCount: row.access_count,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
  };
}
