const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * Gemini access with multi-key failover.
 *
 * Gemini's free tier rate-limits aggressively, so the server can be configured
 * with several API keys (GEMINI_API_KEYS="k1,k2,k3"). When a key hits a rate
 * limit or a server error, it's put on a cooldown and the next key is tried,
 * which keeps the app working through transient quota exhaustion.
 */

// Accept either a comma-separated list (preferred) or a single key.
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || 'dummy_key';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

// Each key tracks when it becomes usable again (0 = available now).
const keyPool = apiKeys.map(key => ({
  key,
  exhaustedUntil: 0
}));

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Runs `actionFn(genAI)` against the first healthy key, failing over on rate
 * limits / 5xx and surfacing any other error immediately (those won't be fixed
 * by switching keys). Throws if every key is exhausted.
 *
 * @param {(genAI: GoogleGenerativeAI) => Promise<T>} actionFn
 * @returns {Promise<T>}
 */
async function executeWithFallback(actionFn) {
  let lastError = null;
  
  for (let i = 0; i < keyPool.length; i++) {
    const poolItem = keyPool[i];

    // Skip keys still in cooldown from a recent rate limit / outage.
    if (poolItem.exhaustedUntil > Date.now()) {
      continue;
    }

    try {
      const genAI = new GoogleGenerativeAI(poolItem.key);
      return await actionFn(genAI);
    } catch (err) {
      console.warn(`API Key ${i} failed. Reason: ${err.message}`);
      if (err.status === 403) {
        console.warn(`403 Details:`, JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      }
      lastError = err;

      const isRateLimit = err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('quota'));
      const isServerError = err.status >= 500 || (err.message && err.message.includes('500'));
      const isForbidden = err.status === 403 || (err.message && err.message.includes('403'));

      if (isRateLimit || isServerError || isForbidden) {
        // Recoverable by switching keys: cool this one down and try the next.
        poolItem.exhaustedUntil = Date.now() + COOLDOWN_MS;
      } else {
        // Anything else (bad request, malformed prompt) won't be fixed by
        // another key — fail fast.
        throw err;
      }
    }
  }
  
  throw new Error(`All available Gemini API keys are exhausted or failed. Last error: ${lastError?.message || 'None'}`);
}

module.exports = { executeWithFallback };
