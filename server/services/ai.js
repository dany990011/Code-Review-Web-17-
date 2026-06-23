const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || 'dummy_key';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

const keyPool = apiKeys.map(key => ({
  key,
  exhaustedUntil: 0
}));

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

async function executeWithFallback(actionFn) {
  let lastError = null;
  
  for (let i = 0; i < keyPool.length; i++) {
    const poolItem = keyPool[i];
    
    if (poolItem.exhaustedUntil > Date.now()) {
      continue;
    }
    
    try {
      const genAI = new GoogleGenerativeAI(poolItem.key);
      const result = await actionFn(genAI);
      return result;
    } catch (err) {
      console.warn(`API Key ${i} failed. Reason: ${err.message}`);
      lastError = err;
      
      const isRateLimit = err.status === 429 || (err.message && err.message.includes('429')) || (err.message && err.message.toLowerCase().includes('quota'));
      const isServerError = err.status >= 500 || (err.message && err.message.includes('500'));
      
      if (isRateLimit || isServerError) {
        poolItem.exhaustedUntil = Date.now() + COOLDOWN_MS;
      } else {
        throw err;
      }
    }
  }
  
  throw new Error(`All available Gemini API keys are exhausted or failed. Last error: ${lastError?.message || 'None'}`);
}

module.exports = { executeWithFallback };
