import { describe, it, expect, beforeEach } from "vitest";
import { extractMemories } from "../src/compressor.js";
import { StorageEngine } from "../src/storage.js";
import { DecayManager } from "../src/decay.js";
import { SessionHook } from "../src/session.js";
import { DEFAULT_CONFIG } from "../src/config.js";

describe("extractMemories", () => {
  it("extracts decisions", () => {
    const r = extractMemories("We decided to use TypeScript for the project");
    expect(r.some(m => m.category === "decision")).toBe(true);
  });

  it("extracts preferences", () => {
    const r = extractMemories("I prefer dark mode over light mode");
    expect(r.some(m => m.category === "preference")).toBe(true);
  });

  it("extracts instructions", () => {
    const r = extractMemories("Always use semicolons in code");
    expect(r.some(m => m.category === "instruction")).toBe(true);
  });

  it("falls back to context for long unmatched text", () => {
    const r = extractMemories("The quick brown fox jumped over the lazy dog and then went home to rest for a while because it was tired.");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].category).toBe("context");
  });
});

describe("StorageEngine", () => {
  let store: StorageEngine;
  beforeEach(() => { store = new StorageEngine(); });

  it("inserts and retrieves memories", () => {
    store.insert("a1", "s1", "fact", "User likes coffee", 0.7);
    store.insert("a1", "s1", "decision", "Use React", 0.8);
    const all = store.getByAgent("a1");
    expect(all).toHaveLength(2);
    expect(all[0].importance).toBe(0.8); // ordered by importance desc
  });

  it("searches by keyword", () => {
    store.insert("a1", "s1", "fact", "User likes coffee", 0.7);
    store.insert("a1", "s1", "fact", "User likes tea", 0.5);
    const r = store.search("a1", "coffee");
    expect(r).toHaveLength(1);
    expect(r[0].content).toContain("coffee");
  });

  it("records access and updates count", () => {
    const mem = store.insert("a1", "s1", "fact", "test", 0.5);
    store.recordAccess(mem.id);
    store.recordAccess(mem.id);
    const updated = store.getByAgent("a1")[0];
    expect(updated.accessCount).toBe(2);
  });
});

describe("DecayManager", () => {
  it("prunes low-importance old memories", () => {
    const store = new StorageEngine();
    // Insert a memory with very low importance
    store.insert("a1", "s1", "context", "old stuff", 0.01);
    const dm = new DecayManager(store, { ...DEFAULT_CONFIG, pruneThreshold: 0.05 });
    const pruned = dm.decay("a1");
    expect(pruned).toBe(1);
    expect(store.count("a1")).toBe(0);
  });
});

describe("SessionHook", () => {
  it("end-to-end: store on end, retrieve on start", () => {
    const store = new StorageEngine();
    const hook = new SessionHook(store);

    // End a session with conversation
    const stored = hook.onSessionEnd("a1", "s1", "I decided to use Vim. I prefer tabs over spaces.");
    expect(stored.length).toBeGreaterThan(0);

    // Start a new session — should get memories back
    const recalled = hook.onSessionStart("a1");
    expect(recalled.length).toBeGreaterThan(0);
  });
});
