#!/usr/bin/env node

import { readFileSync } from "fs";
import { compress, recall } from "./session.js";

const args = process.argv.slice(2);
const cmd = args[0];

function usage(): void {
  console.log(`agent-session-memory — Session memory compression and replay

Usage:
  agent-session-memory compress <session-file> [--agent <id>] [--session <id>] [--storage <path>]
  agent-session-memory recall --query "..." [--agent <id>] [--storage <path>]

Commands:
  compress   Extract and store memories from a session transcript
  recall     Search stored memories by keyword

Options:
  --agent <id>       Agent identifier (default: "default")
  --session <id>     Session identifier (auto-generated if omitted)
  --storage <path>   Storage directory (default: ".agent-memory")
  --query <text>     Search query for recall
`);
  process.exit(0);
}

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

if (!cmd || cmd === "--help" || cmd === "-h") usage();

const agentId = getFlag("--agent") || "default";
const storagePath = getFlag("--storage");

if (cmd === "compress") {
  const file = args[1];
  if (!file || file.startsWith("--")) {
    console.error("Error: compress requires a session file path");
    process.exit(1);
  }
  const text = readFileSync(file, "utf-8");
  const sessionId = getFlag("--session");
  const result = compress(text, agentId, sessionId || undefined, storagePath || undefined);
  console.log(JSON.stringify({
    sessionId: result.sessionId,
    memoriesExtracted: result.memories.length,
    categories: [...new Set(result.memories.map(m => m.category))],
    summary: result.summary.slice(0, 200) + (result.summary.length > 200 ? "..." : ""),
  }, null, 2));
} else if (cmd === "recall") {
  const query = getFlag("--query");
  if (!query) {
    console.error("Error: recall requires --query");
    process.exit(1);
  }
  const results = recall(query, agentId, storagePath || undefined);
  console.log(JSON.stringify(results.map(m => ({
    category: m.category,
    content: m.content,
    importance: m.importance,
    keywords: m.keywords,
    sessionId: m.sessionId,
  })), null, 2));
} else {
  console.error(`Unknown command: ${cmd}`);
  usage();
}
