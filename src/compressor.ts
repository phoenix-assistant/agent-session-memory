import { MemoryCategory } from "./config.js";

export interface ExtractedMemory {
  category: MemoryCategory;
  content: string;
  importance: number;
}

const PATTERNS: { category: MemoryCategory; regex: RegExp; importance: number }[] = [
  { category: "decision", regex: /(?:decided|chosen|agreed|will go with|let's go with|decision:)\s*(.+)/gi, importance: 0.8 },
  { category: "preference", regex: /(?:prefer|like|want|don't like|hate|love|rather)\s+(.+)/gi, importance: 0.6 },
  { category: "instruction", regex: /(?:always|never|remember to|make sure|don't forget|rule:)\s*(.+)/gi, importance: 0.9 },
  { category: "fact", regex: /(?:my name is|i am|i live|i work|i use|the \w+ is)\s+(.+)/gi, importance: 0.7 },
];

/**
 * Extract facts, decisions, preferences, and instructions from conversation text.
 */
export function extractMemories(text: string): ExtractedMemory[] {
  const results: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const { category, regex, importance } of PATTERNS) {
    // Reset regex state
    const re = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const content = match[1]?.trim();
      if (content && content.length > 2 && !seen.has(content.toLowerCase())) {
        seen.add(content.toLowerCase());
        results.push({ category, content: match[0].trim(), importance });
      }
    }
  }

  // If nothing matched but text is substantial, store as context
  if (results.length === 0 && text.length > 50) {
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      results.push({
        category: "context",
        content: compress(text),
        importance: 0.3,
      });
    }
  }

  return results;
}

/** Compress text to a summary-like representation (simple truncation + key extraction) */
function compress(text: string): string {
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10).map(s => s.trim());
  return sentences.slice(0, 5).join(". ") + (sentences.length > 5 ? "..." : "");
}
