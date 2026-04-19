import { MemoryCategory } from "./types.js";
import { extractKeywords } from "./tfidf.js";

export interface ExtractedMemory {
  category: MemoryCategory;
  content: string;
  importance: number;
  keywords: string[];
}

interface Pattern {
  category: MemoryCategory;
  regex: RegExp;
  importance: number;
}

const PATTERNS: Pattern[] = [
  // Decisions
  { category: "decision", regex: /(?:decided|chosen|agreed|will go with|let's go with|decision:)\s*(.+)/gi, importance: 0.8 },
  // Preferences
  { category: "preference", regex: /(?:prefer|like|want|don't like|hate|love|rather)\s+(.+)/gi, importance: 0.6 },
  // Instructions / rules
  { category: "instruction", regex: /(?:always|never|remember to|make sure|don't forget|rule:)\s*(.+)/gi, importance: 0.9 },
  // Facts
  { category: "fact", regex: /(?:my name is|i am|i live|i work at|i use|the \w+ is)\s+(.+)/gi, importance: 0.7 },
  // Tool calls
  { category: "tool_call", regex: /(?:called|invoked|ran|executed|used tool)\s+[`"]?(\w[\w.-]+)[`"]?/gi, importance: 0.5 },
  // Code references
  { category: "code_ref", regex: /(?:file|module|function|class|component)\s+[`"]?([\w./-]+)[`"]?/gi, importance: 0.6 },
  // Code paths
  { category: "code_ref", regex: /(?:[\w-]+\/)+[\w.-]+\.\w{1,5}/g, importance: 0.5 },
];

/**
 * Extract structured memories from conversation text using pattern matching + TF-IDF.
 */
export function extractMemories(text: string): ExtractedMemory[] {
  const results: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const { category, regex, importance } of PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const content = (match[1] || match[0]).trim();
      if (content && content.length > 2 && !seen.has(content.toLowerCase())) {
        seen.add(content.toLowerCase());
        const kw = extractKeywords(content, 5).map(k => k.term);
        results.push({ category, content: match[0].trim(), importance, keywords: kw });
      }
    }
  }

  // Context fallback for substantial text with no pattern matches
  if (results.length === 0 && text.length > 50) {
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      const summary = sentences.slice(0, 5).map(s => s.trim()).join(". ") + (sentences.length > 5 ? "..." : "");
      const kw = extractKeywords(text, 10).map(k => k.term);
      results.push({ category: "context", content: summary, importance: 0.3, keywords: kw });
    }
  }

  return results;
}

/**
 * Compress a full session transcript into a concise summary.
 */
export function compressSession(text: string): string {
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 10).map(s => s.trim());
  const keywords = extractKeywords(text, 15);
  const keyTerms = keywords.map(k => k.term).join(", ");
  const topSentences = sentences.slice(0, 8).join(". ");
  return `Key topics: ${keyTerms}\n\nHighlights: ${topSentences}${sentences.length > 8 ? "..." : ""}`;
}
