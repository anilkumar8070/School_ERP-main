/**
 * Simple in-memory cache using a JavaScript Map (unordered map semantics).
 * Reduces time complexity and database load for frequently accessed, rarely changing endpoints.
 */

const cacheStore = new Map();

/**
 * Get a value from the cache
 * @param {string} key 
 */
function getCache(key) {
  const item = cacheStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return item.value;
}

/**
 * Set a value in the cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Time to live in seconds
 */
function setCache(key, value, ttlSeconds = 300) {
  cacheStore.set(key, {
    value,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}

/**
 * Clear a specific key or the entire cache
 */
function clearCache(key) {
  if (key) {
    cacheStore.delete(key);
  } else {
    cacheStore.clear();
  }
}

/**
 * Express middleware to cache responses.
 * Usage: router.get('/endpoint', cacheMiddleware(300), handler)
 */
function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Create a unique key based on URL and query params
    const key = `cache:${req.originalUrl || req.url}`;
    const cachedResponse = getCache(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Hijack res.json to store the response in cache before sending
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      setCache(key, body, ttlSeconds);
      return originalJson(body);
    };
    
    next();
  };
}

module.exports = {
  getCache,
  setCache,
  clearCache,
  cacheMiddleware
};
