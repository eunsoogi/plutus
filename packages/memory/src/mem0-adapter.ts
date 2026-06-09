import { createId, relevance, tokenize } from "./utils";

export interface Mem0AddInput {
  text: string;
  metadata: Record<string, unknown>;
}

export interface Mem0SearchInput {
  query: string;
  limit?: number;
}

export interface Mem0UpdateInput {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface Mem0WriteResult {
  id: string;
}

export interface Mem0SearchResult {
  id: string;
  score: number;
  text: string;
}

export interface Mem0Adapter {
  add(input: Mem0AddInput): Promise<Mem0WriteResult>;
  search(input: Mem0SearchInput): Promise<Mem0SearchResult[]>;
  update(input: Mem0UpdateInput): Promise<Mem0WriteResult>;
  delete(mem0Id: string): Promise<void>;
}

export class FakeMem0Adapter implements Mem0Adapter {
  records: Array<{
    id: string;
    text: string;
    metadata: Record<string, unknown>;
  }> = [];

  async add(input: Mem0AddInput): Promise<Mem0WriteResult> {
    const id = createId();
    this.records.push({ id, text: input.text, metadata: input.metadata });
    return { id };
  }

  async search(input: Mem0SearchInput): Promise<Mem0SearchResult[]> {
    const terms = tokenize(input.query);
    return this.records
      .map((record) => ({
        id: record.id,
        text: record.text,
        score: relevance(record.text, terms),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit ?? 10);
  }

  async update(input: Mem0UpdateInput): Promise<Mem0WriteResult> {
    const found = this.records.find((record) => record.id === input.id);
    if (!found) throw new Error(`Mem0 record not found: ${input.id}`);
    found.text = input.text;
    found.metadata = input.metadata;
    return { id: input.id };
  }

  async delete(mem0Id: string): Promise<void> {
    this.records = this.records.filter((record) => record.id !== mem0Id);
  }
}
