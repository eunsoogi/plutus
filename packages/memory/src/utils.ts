export function inferTags(text: string): string[] {
  const tags = new Set<string>();
  if (/\bbtc|bitcoin\b/i.test(text)) tags.add("btc");
  if (/crossover|moving average/i.test(text)) tags.add("crossover");
  return [...tags];
}

export function relevance(text: string, terms: string[]): number {
  const haystack = text.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return terms.length === 0 ? 0 : hits / terms.length;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
}

export function createId(): string {
  return crypto.randomUUID();
}
