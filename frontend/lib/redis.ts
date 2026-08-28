// lib/redis.ts
import Redis from 'ioredis'

/**
 * Shared Redis client for Next.js Server Side.
 * 
 * IMPORTANT: This must only be imported in Server Components or API Routes.
 */

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.warn('⚠️ REDIS_URL is not defined in environment variables.')
}

// We use ioredis because we have a standard rediss:// connection string.
// This is shared with the FastAPI backend.
export const redis = redisUrl ? new Redis(redisUrl) : null
