// Redis-based cache with fallback to in-memory cache
import Redis from 'ioredis';
import { logger } from './logger';
import { ResponseCache } from './response-cache';

export interface CacheEntry {
  response: string;
  timestamp: number;
  hitCount: number;
}

export class RedisCache {
  private redis: Redis | null = null;
  private fallbackCache: ResponseCache;
  private useRedis: boolean = false;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 1000, ttl: number = 3600000) {
    this.ttl = ttl;
    this.fallbackCache = new ResponseCache(maxSize, ttl);
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
    const redisPassword = process.env.REDIS_PASSWORD;

    // Try to connect to Redis if configured
    if (redisUrl || redisHost) {
      try {
        this.redis = redisUrl
          ? new Redis(redisUrl, {
              retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
              },
              maxRetriesPerRequest: 3,
            })
          : new Redis({
              host: redisHost,
              port: redisPort,
              password: redisPassword,
              retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
              },
              maxRetriesPerRequest: 3,
            });

        // Test connection
        await this.redis.ping();
        this.useRedis = true;
        logger.info('Redis cache connected successfully');
      } catch (error) {
        logger.warn('Failed to connect to Redis, using in-memory cache fallback:', error);
        this.redis = null;
        this.useRedis = false;
      }
    } else {
      logger.info('Redis not configured, using in-memory cache');
      this.useRedis = false;
    }
  }

  private generateKey(query: string, context?: any): string {
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const contextKey = context
      ? `${context.crop || ''}-${context.region || ''}-${context.farmStage || ''}`
      : '';
    return `shambasmart:cache:${normalizedQuery}-${contextKey}`;
  }

  async get(query: string, context?: any): Promise<string | null> {
    const key = this.generateKey(query, context);

    if (this.useRedis && this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          // Update hit count
          entry.hitCount++;
          await this.redis.set(key, JSON.stringify(entry), 'PX', this.ttl);
          logger.debug(`Redis cache hit for query: ${query.substring(0, 50)}...`);
          return entry.response;
        }
      } catch (error) {
        logger.warn('Redis get error, falling back to in-memory cache:', error);
        // Fallback to in-memory cache
        return this.fallbackCache.get(query, context);
      }
    }

    // Use fallback cache
    return this.fallbackCache.get(query, context);
  }

  async set(query: string, response: string, context?: any): Promise<void> {
    const key = this.generateKey(query, context);
    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
      hitCount: 0,
    };

    if (this.useRedis && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(entry), 'PX', this.ttl);
        logger.debug(`Cached response in Redis for query: ${query.substring(0, 50)}...`);
        // Also update fallback cache
        this.fallbackCache.set(query, response, context);
        return;
      } catch (error) {
        logger.warn('Redis set error, falling back to in-memory cache:', error);
        // Fallback to in-memory cache
        this.fallbackCache.set(query, response, context);
        return;
      }
    }

    // Use fallback cache
    this.fallbackCache.set(query, response, context);
  }

  async clear(): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        const keys = await this.redis.keys('shambasmart:cache:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        logger.info('Redis cache cleared');
      } catch (error) {
        logger.warn('Redis clear error:', error);
      }
    }
    this.fallbackCache.clear();
  }

  async getStats(): Promise<{ size: number; totalHits: number; type: 'redis' | 'memory' }> {
    if (this.useRedis && this.redis) {
      try {
        const keys = await this.redis.keys('shambasmart:cache:*');
        let totalHits = 0;
        for (const key of keys) {
          const cached = await this.redis.get(key);
          if (cached) {
            const entry: CacheEntry = JSON.parse(cached);
            totalHits += entry.hitCount;
          }
        }
        return {
          size: keys.length,
          totalHits,
          type: 'redis',
        };
      } catch (error) {
        logger.warn('Redis stats error:', error);
      }
    }

    const stats = this.fallbackCache.getStats();
    return {
      size: stats.size,
      totalHits: stats.totalHits,
      type: 'memory',
    };
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis connection closed');
    }
  }
}

// Singleton instance
export const redisCache = new RedisCache(1000, 3600000); // 1000 entries, 1 hour TTL

