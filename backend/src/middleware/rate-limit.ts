/**
 * In-memory rate limiting. Suitable for a single backend instance; a
 * multi-instance deployment needs a shared store (see docs/deployment.md).
 */

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
    private readonly maxKeys = 50000,
  ) {}

  hit(key: string): LimitResult {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      if (!window && this.windows.size >= this.maxKeys) this.prune(now);
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    if (window.count >= this.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((window.start + this.windowMs - now) / 1000)) };
    }
    window.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
    // Under a flood of unique keys, fail towards protecting memory.
    if (this.windows.size >= this.maxKeys) this.windows.clear();
  }
}

/** Caps total chat requests per UTC day to bound provider cost. */
export class DailyBudget {
  private day = '';
  private used = 0;

  constructor(
    private readonly limit: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  consume(): LimitResult {
    const date = new Date(this.now());
    const today = date.toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used = 0;
    }
    if (this.used >= this.limit) {
      const tomorrow = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((tomorrow - date.getTime()) / 1000)) };
    }
    this.used += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/** Caps repeated abusive requests (injection, profanity) from a client. */
export class AbusePenaltyTracker {
  private readonly violations = new Map<string, { count: number; windowStart: number; blockedUntil: number }>();

  constructor(
    private readonly threshold = 3,
    private readonly windowMs = 5 * 60_000,
    private readonly penaltyMs = 10 * 60_000,
    private readonly now: () => number = () => Date.now(),
    private readonly maxKeys = 20000,
  ) {}

  check(key: string): LimitResult {
    const now = this.now();
    const entry = this.violations.get(key);
    if (!entry) return { allowed: true, retryAfterSeconds: 0 };
    if (now < entry.blockedUntil) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  recordViolation(key: string): LimitResult {
    const now = this.now();
    let entry = this.violations.get(key);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      if (!entry && this.violations.size >= this.maxKeys) this.prune(now);
      entry = { count: 0, windowStart: now, blockedUntil: 0 };
      this.violations.set(key, entry);
    }
    entry.count += 1;
    if (entry.count >= this.threshold) {
      entry.blockedUntil = now + this.penaltyMs;
      return { allowed: false, retryAfterSeconds: Math.ceil(this.penaltyMs / 1000) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.violations) {
      if (now >= entry.blockedUntil && now - entry.windowStart >= this.windowMs) {
        this.violations.delete(key);
      }
    }
    if (this.violations.size >= this.maxKeys) this.violations.clear();
  }
}

export interface CachedResponse {
  answer: string;
  sources: { title: string; url: string }[];
  grounded: boolean;
  cachedAt: number;
}

/** In-memory cache for grounded FAQ responses without conversation history. */
export class ResponseCache {
  private readonly cache = new Map<string, CachedResponse>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private namespace = 'default';

  constructor(
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly maxSize = 500,
    private readonly now: () => number = () => Date.now(),
  ) {}

  setNamespace(ns: string): void {
    if (this.namespace !== ns) {
      this.namespace = ns;
      this.cache.clear();
      this.inflight.clear();
    }
  }

  private makeKey(language: string, message: string): string {
    const norm = message.toLowerCase().trim().replace(/\s+/g, ' ');
    return `${this.namespace}:${language}:${norm}`;
  }

  get(language: string, message: string): CachedResponse | null {
    const key = this.makeKey(language, message);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (this.now() - entry.cachedAt >= this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry;
  }

  set(language: string, message: string, data: Omit<CachedResponse, 'cachedAt'>): void {
    if (!data.grounded) return;
    const key = this.makeKey(language, message);
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      answer: data.answer,
      sources: data.sources.map((s) => ({ ...s })),
      grounded: data.grounded,
      cachedAt: this.now(),
    });
  }

  getInflight<T>(language: string, message: string): Promise<T> | undefined {
    return this.inflight.get(this.makeKey(language, message)) as Promise<T> | undefined;
  }

  setInflight<T>(language: string, message: string, promise: Promise<T>): Promise<T> {
    const key = this.makeKey(language, message);
    const wrapped = promise.finally(() => {
      if (this.inflight.get(key) === wrapped) {
        this.inflight.delete(key);
      }
    });
    this.inflight.set(key, wrapped);
    return wrapped;
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
