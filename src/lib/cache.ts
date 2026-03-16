// In-memory cache with TTL eviction and max size cap
// Uses globalThis singleton pattern (same as db.ts)

export const TTL = {
  DRUG_PRICES: 15 * 60 * 1000,      // 15 minutes
  SEARCH_RESULTS: 5 * 60 * 1000,    // 5 minutes
  AUTOCOMPLETE: 10 * 60 * 1000,     // 10 minutes
  STATS: 5 * 60 * 1000,             // 5 minutes
} as const;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl: number): void {
    // Evict expired entries if at capacity
    if (this.store.size >= this.maxSize) {
      this.evict();
    }
    // If still at capacity after eviction, remove oldest entry
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Singleton via globalThis (survives HMR in dev)
const globalForCache = globalThis as unknown as {
  cache: MemoryCache | undefined;
};

export const cache: MemoryCache =
  globalForCache.cache ?? new MemoryCache(500);

if (process.env.NODE_ENV !== "production") globalForCache.cache = cache;

// Simple IP-based rate limiter using the cache
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}
