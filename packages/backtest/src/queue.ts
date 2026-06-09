import { createBtcMovingAverageCrossoverFixture } from "./fixtures";
import { runLongOnlyBacktestSync } from "./sync-backtest";
import type {
  BacktestEngine,
  BacktestInput,
  BacktestResult,
  StrategySpec,
} from "./types";

export class LocalBacktestQueue {
  private readonly storage = new Map<string, string>();
  private readonly queue = new BacktestQueue({ storage: this.storage });

  enqueue(spec: StrategySpec): string {
    const fixture = createBtcMovingAverageCrossoverFixture();
    const id = crypto.randomUUID();
    void this.queue.enqueue({
      runId: id,
      spec,
      candles: fixture.candles,
      benchmarkCandles: fixture.benchmarkCandles,
      dataSourceRefs: fixture.dataSourceRefs,
    });
    return id;
  }

  resume(id: string): { status: BacktestQueueStatus } | undefined {
    const item = this.queue.list().find((candidate) => candidate.id === id);
    if (!item) return undefined;
    const result = runLongOnlyBacktestSync(item.input);
    return { status: result ? "completed" : "failed" };
  }
}

export type BacktestQueueStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface BacktestQueueItem {
  id: string;
  input: BacktestInput;
  status: BacktestQueueStatus;
  result?: BacktestResult;
  error?: string;
}

export class BacktestQueue {
  private readonly storageKey = "plutus-backtest-queue";
  private items: BacktestQueueItem[];

  constructor(
    private readonly options: { storage?: Map<string, string> } = {},
  ) {
    const raw = this.options.storage?.get(this.storageKey);
    this.items = raw ? (JSON.parse(raw) as BacktestQueueItem[]) : [];
    for (const item of this.items) {
      if (item.status === "running") item.status = "pending";
    }
    this.persist();
  }

  async enqueue(input: BacktestInput): Promise<BacktestQueueItem> {
    const item: BacktestQueueItem = {
      id: input.runId,
      input,
      status: "pending",
    };
    this.items.push(item);
    this.persist();
    return item;
  }

  async resumePending(engine: BacktestEngine): Promise<BacktestQueueItem[]> {
    const processed: BacktestQueueItem[] = [];
    for (const item of this.items.filter(
      (queueItem) => queueItem.status === "pending",
    )) {
      item.status = "running";
      this.persist();
      try {
        item.result = await engine.run(item.input);
        item.status = "completed";
      } catch (error) {
        item.status = "failed";
        item.error = error instanceof Error ? error.message : String(error);
      }
      processed.push(item);
      this.persist();
    }
    return processed;
  }

  list(): BacktestQueueItem[] {
    return this.items.map((item) => ({ ...item }));
  }

  private persist(): void {
    this.options.storage?.set(this.storageKey, JSON.stringify(this.items));
  }
}
