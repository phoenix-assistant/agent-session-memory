import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { extractMemories, compressSession } from "../src/compressor.js";
import { extractKeywords } from "../src/tfidf.js";
import { StorageEngine } from "../src/storage.js";
import { DecayManager } from "../src/decay.js";
import { SessionHook, compress, recall, store } from "../src/session.js";
import { DEFAULT_CONFIG } from "../src/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "asm-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("TF-IDF", () => {
  it("extracts keywords from text", () => {
    const kw = extractKeywords("TypeScript is great for building server applications. TypeScript provides type safety.", 5);
    expect(kw.length).toBeGreaterThan(0);
    expect(kw[0].term).toBeDefined();
    expect(kw[0].score).toBeGreaterThan(0);
  });

  it("returns empty for empty text", () => {
    expect(extractKeywords("", 5)).toEqual([]);
  });

  it("filters stop words", () => {
    const kw = extractKeywords("the quick brown fox jumps over the lazy dog", 10);
    const terms = kw.map(k => k.term);
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("over");
  });
});

describe("Compressor", () => {
  it("extracts decisions", () => {
    const mems = extractMemories("We decided to use PostgreSQL for the database.");
    expect(mems.some(m => m.category === "decision")).toBe(true);
  });

  it("extracts preferences", () => {
    const mems = extractMemories("I prefer TypeScript over JavaScript.");
    expect(mems.some(m => m.category === "preference")).toBe(true);
  });

  it("extracts instructions", () => {
    const mems = extractMemories("Always run tests before deploying to production.");
    expect(mems.some(m => m.category === "instruction")).toBe(true);
  });

  it("extracts facts", () => {
    const mems = extractMemories("My name is Krrish and I work at Microsoft.");
    expect(mems.some(m => m.category === "fact")).toBe(true);
  });

  it("extracts code references", () => {
    const mems = extractMemories("Check src/utils/helper.ts for the implementation.");
    expect(mems.some(m => m.category === "code_ref")).toBe(true);
  });

  it("falls back to context for unstructured text", () => {
    const mems = extractMemories("The weather today was quite pleasant and we spent time discussing various topics about architecture and design patterns in modern software engineering.");
    expect(mems.length).toBeGreaterThan(0);
    expect(mems[0].category).toBe("context");
  });

  it("includes keywords in extracted memories", () => {
    const mems = extractMemories("We decided to use Redis for caching layer.");
    const decision = mems.find(m => m.category === "decision");
    expect(decision?.keywords).toBeDefined();
    expect(decision!.keywords.length).toBeGreaterThan(0);
  });

  it("compresses session text", () => {
    const text = "We discussed the migration plan. The database will be PostgreSQL. Frontend uses React. We need to set up CI/CD. Testing is critical.";
    const result = compressSession(text);
    expect(result).toContain("Key topics:");
    expect(result).toContain("Highlights:");
  });
});

describe("StorageEngine", () => {
  it("inserts and retrieves memories", () => {
    const s = new StorageEngine(tmpDir);
    const mem = s.insert("agent1", "sess1", "fact", "User is Krrish", 0.7);
    expect(mem.id).toBeDefined();
    const all = s.all("agent1");
    expect(all).toHaveLength(1);
    expect(all[0].content).toBe("User is Krrish");
  });

  it("searches by keyword", () => {
    const s = new StorageEngine(tmpDir);
    s.insert("agent1", "s1", "fact", "Uses TypeScript", 0.7);
    s.insert("agent1", "s1", "fact", "Uses Python", 0.7);
    const results = s.search("agent1", "typescript");
    expect(results).toHaveLength(1);
  });

  it("filters by importance", () => {
    const s = new StorageEngine(tmpDir);
    s.insert("agent1", "s1", "fact", "low", 0.1);
    s.insert("agent1", "s1", "decision", "high", 0.9);
    const results = s.getByAgent("agent1", { minImportance: 0.5 });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("high");
  });

  it("records access", () => {
    const s = new StorageEngine(tmpDir);
    const mem = s.insert("agent1", "s1", "fact", "test", 0.5);
    s.recordAccess("agent1", mem.id);
    const updated = s.all("agent1")[0];
    expect(updated.accessCount).toBe(1);
  });

  it("deletes memories", () => {
    const s = new StorageEngine(tmpDir);
    const mem = s.insert("agent1", "s1", "fact", "test", 0.5);
    s.delete("agent1", mem.id);
    expect(s.count("agent1")).toBe(0);
  });

  it("stores and loads compressed sessions", () => {
    const s = new StorageEngine(tmpDir);
    const session = { sessionId: "s1", agentId: "a1", memories: [], summary: "test", compressedAt: Date.now() };
    s.storeCompressedSession(session);
    const loaded = s.loadCompressedSession("s1");
    expect(loaded?.summary).toBe("test");
  });

  it("returns null for missing session", () => {
    const s = new StorageEngine(tmpDir);
    expect(s.loadCompressedSession("nonexistent")).toBeNull();
  });
});

describe("DecayManager", () => {
  it("prunes old low-importance memories", () => {
    const s = new StorageEngine(tmpDir);
    // Insert memory with artificially old timestamp
    const mem = s.insert("agent1", "s1", "context", "old stuff", 0.1);
    // Manually adjust createdAt to 100 days ago
    const all = s.all("agent1");
    all[0].createdAt = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const { writeFileSync } = require("fs");
    writeFileSync(join(tmpDir, "agent1.json"), JSON.stringify(all));

    const decay = new DecayManager(s);
    const pruned = decay.decay("agent1");
    expect(pruned).toBeGreaterThan(0);
    expect(s.count("agent1")).toBe(0);
  });
});

describe("SessionHook", () => {
  it("extracts and stores memories on session end", () => {
    const s = new StorageEngine(tmpDir);
    const hook = new SessionHook(s);
    const mems = hook.onSessionEnd("agent1", "s1", "We decided to use Postgres. Always run tests first.");
    expect(mems.length).toBeGreaterThan(0);
    expect(s.count("agent1")).toBeGreaterThan(0);
  });

  it("returns memories on session start", () => {
    const s = new StorageEngine(tmpDir);
    const hook = new SessionHook(s);
    hook.onSessionEnd("agent1", "s1", "We decided to use Redis. My name is Krrish.");
    const recalled = hook.onSessionStart("agent1");
    expect(recalled.length).toBeGreaterThan(0);
  });
});

describe("Top-level API", () => {
  it("compress() works end-to-end", () => {
    const result = compress("We decided to use SQLite. Always validate inputs.", "test-agent", "sess-1", tmpDir);
    expect(result.sessionId).toBe("sess-1");
    expect(result.memories.length).toBeGreaterThan(0);
    expect(result.summary).toContain("Key topics:");
  });

  it("recall() finds stored memories", () => {
    compress("We decided to use TypeScript for everything.", "test-agent", "s1", tmpDir);
    const results = recall("TypeScript", "test-agent", tmpDir);
    expect(results.length).toBeGreaterThan(0);
  });

  it("store() inserts a single memory", () => {
    const mem = store("test-agent", "s1", "fact", "User prefers dark mode", 0.7, tmpDir);
    expect(mem.content).toBe("User prefers dark mode");
    const s = new StorageEngine(tmpDir);
    expect(s.count("test-agent")).toBe(1);
  });
});
