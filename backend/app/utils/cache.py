# app/utils/cache.py
import os
import json
import redis
from typing import Optional, Any

# 🚀 Use Redis for caching expensive results
REDIS_URL = os.getenv("REDIS_CACHE_URL", os.getenv("REDIS_URL"))

class CacheManager:
    def __init__(self):
        self.enabled = bool(REDIS_URL)
        self.redis = None
        if self.enabled:
            try:
                # Use from_url for easy connection (UPSTASH support)
                self.redis = redis.from_url(REDIS_URL, decode_responses=True)
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}")
                self.enabled = False

    def get(self, key: str) -> Optional[Any]:
        if not self.enabled or not self.redis:
            return None
        try:
            val = self.redis.get(key)
            return json.loads(val) if val else None
        except:
            return None

    def set(self, key: str, value: Any, ttl: int = 3000):
        if not self.enabled or not self.redis:
            return
        try:
            self.redis.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            print(f"⚠️ Redis set failed: {e}")

# Global instance
cache = CacheManager()
