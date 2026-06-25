/**
 * Minimal in-memory rate limiter (no external dependencies).
 *
 * Why it exists: the AI endpoints (analyze / check-requirements / chat) are
 * unauthenticated and each one triggers an expensive Gemini call. Without a
 * limiter, anyone holding a project id could loop requests and burn the whole
 * Gemini quota (and rack up cost). This caps how often a single client (IP) can
 * hit a given route.
 *
 * Scope/caveat: state lives in this process's memory, so it is per-instance. A
 * multi-instance / serverless deployment needs a shared store (e.g. Redis) to
 * enforce a global limit. For a single-server deployment this is sufficient.
 *
 * @param {object}  opts
 * @param {number}  opts.windowMs  Size of the rolling window, in ms.
 * @param {number}  opts.max       Max allowed requests per IP per window.
 * @param {string} [opts.message]  Optional message returned on a 429.
 * @returns {import('express').RequestHandler}
 */
function rateLimit({ windowMs, max, message }) {
  // key (client IP) -> { count, resetAt }
  const hits = new Map();

  // Periodically drop expired buckets so the Map can't grow without bound.
  // unref() lets the process exit naturally despite this timer.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  if (typeof sweep.unref === 'function') sweep.unref();

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      // First request in a fresh window.
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: message || 'Too many requests. Please slow down and try again shortly.'
      });
    }
    next();
  };
}

module.exports = rateLimit;
