// Simple in-memory cache for common queries to improve performance
import { logger } from './logger';

interface CacheEntry {
  response: string;
  timestamp: number;
  hitCount: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds (default: 1 hour)

  constructor(maxSize: number = 100, ttl: number = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  // Generate cache key from query and context
  private generateKey(query: string, context?: any): string {
    // Normalize query (lowercase, trim, remove extra spaces)
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Include relevant context in key (crop, region, but not user-specific data)
    const contextKey = context 
      ? `${context.crop || ''}-${context.region || ''}-${context.farmStage || ''}`
      : '';
    
    return `${normalizedQuery}-${contextKey}`;
  }

  get(query: string, context?: any): string | null {
    const key = this.generateKey(query, context);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count for statistics
    entry.hitCount++;
    logger.debug(`Cache hit for query: ${query.substring(0, 50)}...`);
    return entry.response;
  }

  set(query: string, response: string, context?: any): void {
    const key = this.generateKey(query, context);
    
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hitCount: 0,
    });

    logger.debug(`Cached response for query: ${query.substring(0, 50)}...`);
  }

  // Clear expired entries
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; totalHits: number; entries: Array<{ query: string; hits: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      query: key.substring(0, 50),
      hits: entry.hitCount,
    }));

    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      size: this.cache.size,
      totalHits,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10), // Top 10
    };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    logger.info('Response cache cleared');
  }
}

// Singleton instance
export const responseCache = new ResponseCache(100, 3600000); // 100 entries, 1 hour TTL

// Periodically clear expired entries (every 30 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    responseCache.clearExpired();
  }, 1800000); // 30 minutes
}

