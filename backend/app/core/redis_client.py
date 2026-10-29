import hashlib
import json
import logging
from typing import Optional, Dict, Any
import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

CACHE_TTL = 300  # Default 5 minutes TTL


def check_redis_connection() -> bool:
    """Returns True if Redis responds to a PING, False otherwise."""
    try:
        return bool(redis_client.ping())
    except Exception:
        return False


def build_cache_key(
    flag_key: str,
    environment: str,
    user_id: Optional[str] = None,
    groups: Optional[Any] = None,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """Generates a deterministic Redis cache key for flag evaluation requests."""
    env_clean = str(environment).lower().strip()
    uid_clean = str(user_id or "anonymous").strip()
    
    # Normalize groups to a sorted string
    groups_str = ""
    if groups:
        if isinstance(groups, list):
            groups_str = ",".join(sorted([str(g).strip() for g in groups if str(g).strip()]))
        elif isinstance(groups, str):
            groups_str = ",".join(sorted([g.strip() for g in groups.split(",") if g.strip()]))
            
    context_str = json.dumps(context, sort_keys=True) if context else ""
    ctx_hash = hashlib.md5(f"{groups_str}:{context_str}".encode('utf-8')).hexdigest()[:8]
    
    return f"eval:{flag_key}:env:{env_clean}:user:{uid_clean}:ctx:{ctx_hash}"


def get_cached_evaluation(
    flag_key: str,
    environment: str,
    user_id: Optional[str] = None,
    groups: Optional[Any] = None,
    context: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Retrieves cached evaluation response dictionary from Redis if present."""
    if not check_redis_connection():
        return None
    try:
        key = build_cache_key(flag_key, environment, user_id, groups, context)
        cached_raw = redis_client.get(key)
        if cached_raw:
            data = json.loads(cached_raw)
            data["cached"] = True
            data["served_from_cache"] = True
            return data
    except Exception as e:
        logger.warning(f"Failed to fetch evaluation from Redis cache: {e}")
    return None


def set_cached_evaluation(
    flag_key: str,
    environment: str,
    user_id: Optional[str],
    groups: Optional[Any],
    context: Optional[Dict[str, Any]],
    data: Dict[str, Any],
    ttl: int = CACHE_TTL
) -> None:
    """Saves evaluation response dictionary to Redis with TTL."""
    if not check_redis_connection():
        return
    try:
        key = build_cache_key(flag_key, environment, user_id, groups, context)
        data_to_store = dict(data)
        data_to_store["cached"] = True
        data_to_store["served_from_cache"] = True
        redis_client.set(key, json.dumps(data_to_store), ex=ttl)
    except Exception as e:
        logger.warning(f"Failed to store evaluation in Redis cache: {e}")


def invalidate_flag_cache(flag_key: str) -> int:
    """Invalidates all Redis cache keys for a given flag (eval:{flag_key}:* and flag:{flag_key}:*)."""
    if not check_redis_connection():
        return 0
    try:
        patterns = [f"eval:{flag_key}:*", f"flag:{flag_key}:*"]
        deleted_total = 0
        for pattern in patterns:
            keys = redis_client.keys(pattern)
            if keys:
                deleted_total += redis_client.delete(*keys)
        logger.info(f"Invalidated {deleted_total} cache keys for flag '{flag_key}'")
        return deleted_total
    except Exception as e:
        logger.warning(f"Failed to invalidate cache for flag '{flag_key}': {e}")
        return 0


def invalidate_all_eval_cache() -> int:
    """Invalidates all flag evaluation cache keys in Redis."""
    if not check_redis_connection():
        return 0
    try:
        keys = list(redis_client.keys("eval:*"))
        if keys:
            deleted_count = redis_client.delete(*keys)
            logger.info(f"Invalidated all evaluation cache keys ({deleted_count} deleted)")
            return deleted_count
    except Exception as e:
        logger.warning(f"Failed to invalidate all evaluation cache: {e}")
    return 0


# In-memory fallback dictionary for environments without Redis
_in_memory_counters: Dict[str, int] = {}


def get_hourly_key(flag_key: str, dt: Optional[Any] = None) -> str:
    """Formats Redis key per design spec: flag:{flag_key}:{YYYY-MM-DD-HH}"""
    from datetime import datetime, timezone
    now = dt or datetime.now(timezone.utc)
    hour_str = now.strftime("%Y-%m-%d-%H")
    return f"flag:{flag_key}:{hour_str}"


def record_evaluation_count(flag_key: str) -> None:
    """
    Increments evaluation counter in Redis for the current hour (flag:{flag_key}:{YYYY-MM-DD-HH}).
    Falls back to in-memory dictionary if Redis is unreachable.
    """
    key = get_hourly_key(flag_key)
    if check_redis_connection():
        try:
            redis_client.incr(key)
            return
        except Exception as e:
            logger.warning(f"Failed to INCR key '{key}' in Redis: {e}")

    # Fallback to in-memory counter
    _in_memory_counters[key] = _in_memory_counters.get(key, 0) + 1


def get_pending_evaluation_keys() -> Dict[str, int]:
    """
    Scans and retrieves all pending hourly evaluation counts from Redis and in-memory fallback.
    Returns mapping of key -> count.
    """
    counts: Dict[str, int] = {}
    
    # 1. Fetch from Redis if connected
    if check_redis_connection():
        try:
            # Pattern flag:*:YYYY-MM-DD-HH
            keys = redis_client.keys("flag:*:*")
            for k in keys:
                # Exclude eval cache keys if any
                parts = k.split(":")
                if len(parts) == 3 and parts[0] == "flag":
                    try:
                        val = int(redis_client.get(k) or 0)
                        if val > 0:
                            counts[k] = val
                    except Exception:
                        pass
        except Exception as e:
            logger.warning(f"Error reading Redis evaluation keys: {e}")

    # 2. Merge in-memory fallback counters
    for k, val in list(_in_memory_counters.items()):
        counts[k] = counts.get(k, 0) + val

    return counts


def clear_evaluation_key(key: str) -> None:
    """Removes a flushed evaluation key from Redis and in-memory fallback."""
    if check_redis_connection():
        try:
            redis_client.delete(key)
        except Exception:
            pass
    _in_memory_counters.pop(key, None)

