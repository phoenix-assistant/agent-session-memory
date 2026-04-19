/**
 * TF-IDF implementation for keyword extraction — zero dependencies.
 */

export interface TfIdfResult {
  term: string;
  score: number;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "although",
  "this", "that", "these", "those", "i", "me", "my", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "it", "its", "they", "them",
  "their", "what", "which", "who", "whom", "up", "about", "also",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-./]+/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  const max = Math.max(...tf.values(), 1);
  for (const [k, v] of tf) tf.set(k, v / max);
  return tf;
}

/**
 * Extract top keywords from text using TF-IDF with a simple IDF approximation.
 * Since we operate on single documents, IDF is approximated by inverse sentence frequency.
 */
export function extractKeywords(text: string, topN: number = 10): TfIdfResult[] {
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
  const allTokens = tokenize(text);
  const tf = termFrequency(allTokens);

  // IDF: log(numSentences / numSentencesContainingTerm)
  const numDocs = Math.max(sentences.length, 1);
  const docFreq = new Map<string, number>();
  for (const sent of sentences) {
    const unique = new Set(tokenize(sent));
    for (const t of unique) {
      docFreq.set(t, (docFreq.get(t) || 0) + 1);
    }
  }

  const scores: TfIdfResult[] = [];
  for (const [term, tfScore] of tf) {
    const df = docFreq.get(term) || 1;
    const idf = Math.log(numDocs / df) + 1;
    scores.push({ term, score: tfScore * idf });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topN);
}
