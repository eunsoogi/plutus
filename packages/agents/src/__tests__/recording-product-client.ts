export class RecordingProductCodexClient {
  readonly started: Array<Record<string, unknown>> = [];
  readonly structuredTurns: Array<Record<string, unknown>> = [];
  readonly cancelled: string[] = [];
  readonly archived: string[] = [];

  constructor(
    private readonly events: Array<Record<string, unknown>>,
    private readonly structuredResponse: unknown = {},
  ) {}

  async startResearchRun(request: Record<string, unknown>) {
    this.started.push(request);
    return { runId: "run-product", threadId: "thread-product" };
  }

  async *streamResearchRun() {
    for (const event of this.events) {
      yield event;
    }
  }

  async resumeResearchRun(request: { threadId: string }) {
    return { runId: "run-product", threadId: request.threadId };
  }

  async requestStructuredTurn(request: Record<string, unknown>) {
    this.structuredTurns.push(request);
    return this.structuredResponse;
  }

  async cancelResearchRun(request: { threadId: string }) {
    this.cancelled.push(request.threadId);
  }

  async archiveResearchRun(request: { threadId: string }) {
    this.archived.push(request.threadId);
  }
}
