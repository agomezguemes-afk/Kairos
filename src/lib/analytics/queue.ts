// Local-first analytics queue. Pure core with injected storage so the whole
// lifecycle (hydrate → track → persist → export) is unit-testable in node;
// the AsyncStorage wiring lives in index.ts.
//
// Contract: track() is synchronous fire-and-forget and NEVER throws — a
// broken analytics pipe must not take the app down. Persistence failures
// degrade to in-memory only and surface through the onError hook.

export interface AnalyticsEvent {
  event: string;
  props?: Record<string, unknown>;
  /** Epoch ms captured at track() time. */
  timestamp: number;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface AnalyticsQueueOptions {
  /** Oldest events are dropped beyond this cap (memory + storage guard). */
  maxEvents?: number;
  /** Non-fatal problems (corrupt storage, write failure, bad props). */
  onError?: (message: string, error?: unknown) => void;
}

const DEFAULT_MAX_EVENTS = 2000;

interface PersistedShape {
  events: AnalyticsEvent[];
}

function isValidEvent(e: unknown): e is AnalyticsEvent {
  if (typeof e !== 'object' || e === null) return false;
  const c = e as Record<string, unknown>;
  return typeof c.event === 'string' && typeof c.timestamp === 'number';
}

export class AnalyticsQueue {
  private events: AnalyticsEvent[] = [];
  private hydration: Promise<void> | null = null;
  // Serializes storage writes so concurrent track() calls can't interleave.
  private chain: Promise<void> = Promise.resolve();

  private readonly maxEvents: number;
  private readonly onError: (message: string, error?: unknown) => void;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly storageKey: string,
    options: AnalyticsQueueOptions = {},
  ) {
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    this.onError = options.onError ?? (() => {});
  }

  /** Synchronous fire-and-forget. Invalid input is dropped, never thrown. */
  track(event: string, props?: Record<string, unknown>): void {
    if (typeof event !== 'string' || event.trim().length === 0) {
      this.onError('analytics: nombre de evento vacío, descartado');
      return;
    }
    const entry: AnalyticsEvent = { event, timestamp: Date.now() };
    if (props !== undefined) {
      const safe = this.sanitizeProps(props);
      if (safe !== undefined) entry.props = safe;
    }
    this.events.push(entry);
    this.trim();
    this.enqueue(() => this.persist());
  }

  /** Snapshot of the queue (persisted history + this-session events). */
  async getEvents(): Promise<AnalyticsEvent[]> {
    await this.ensureHydrated();
    return [...this.events];
  }

  /** Full queue as pretty-printed JSON, ready to share/inspect. */
  async exportJSON(): Promise<string> {
    const events = await this.getEvents();
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), count: events.length, events },
      null,
      2,
    );
  }

  async clear(): Promise<void> {
    await this.ensureHydrated();
    this.events = [];
    this.enqueue(async () => {
      try {
        await this.storage.removeItem(this.storageKey);
      } catch (e) {
        this.onError('analytics: fallo al limpiar el almacenamiento', e);
      }
    });
    await this.flush();
  }

  /** Resolves when every pending storage write has settled. */
  async flush(): Promise<void> {
    await this.chain;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private ensureHydrated(): Promise<void> {
    if (!this.hydration) {
      this.hydration = this.hydrate();
    }
    return this.hydration;
  }

  private async hydrate(): Promise<void> {
    let persisted: AnalyticsEvent[] = [];
    try {
      const raw = await this.storage.getItem(this.storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        const list = (parsed as PersistedShape)?.events;
        if (Array.isArray(list)) {
          persisted = list.filter(isValidEvent);
        } else {
          this.onError('analytics: formato persistido inesperado, cola reiniciada');
        }
      }
    } catch (e) {
      this.onError('analytics: cola persistida corrupta, cola reiniciada', e);
    }
    // Events tracked before hydration finished are newer than anything on
    // disk — prepend the persisted history to keep chronological order.
    this.events = [...persisted, ...this.events];
    this.trim();
  }

  private enqueue(op: () => Promise<void>): void {
    this.chain = this.chain
      .then(() => this.ensureHydrated())
      .then(op)
      .catch((e) => {
        this.onError('analytics: operación de cola fallida', e);
      });
  }

  private async persist(): Promise<void> {
    try {
      const payload: PersistedShape = { events: this.events };
      await this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (e) {
      // In-memory queue stays intact; the next successful write self-heals.
      this.onError('analytics: fallo al persistir la cola', e);
    }
  }

  private trim(): void {
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(this.events.length - this.maxEvents);
    }
  }

  /** JSON round-trip so circular/exotic props can never poison persist(). */
  private sanitizeProps(props: Record<string, unknown>): Record<string, unknown> | undefined {
    try {
      return JSON.parse(JSON.stringify(props)) as Record<string, unknown>;
    } catch (e) {
      this.onError('analytics: props no serializables, descartadas', e);
      return undefined;
    }
  }
}
