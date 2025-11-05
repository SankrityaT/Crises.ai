/**
 * AI API Rate Limiting Configuration
 * 
 * CRITICAL: These settings control how often AI API calls are made.
 * Adjust these values to balance between data freshness and API costs.
 */

export const AI_RATE_LIMITS = {
  /**
   * Minimum time (in milliseconds) between AI API calls
   * Default: 5 minutes (300,000ms)
   * 
   * With this setting:
   * - Maximum 288 calls per day (12 per hour)
   * - Recommended for production to prevent excessive costs
   * 
   * Adjust based on your needs:
   * - 10 minutes (600,000ms) = 144 calls/day (more conservative)
   * - 15 minutes (900,000ms) = 96 calls/day (very conservative)
   * - 2 minutes (120,000ms) = 720 calls/day (only for testing/demos)
   */
  MIN_CALL_INTERVAL: 5 * 60 * 1000, // 5 minutes

  /**
   * Debounce delay (in milliseconds) before processing AI requests
   * Default: 5 seconds (5,000ms)
   * 
   * This prevents rapid-fire requests when data updates quickly.
   * Increase if you see too many rate-limited messages in console.
   */
  DEBOUNCE_DELAY: 5000, // 5 seconds

  /**
   * Server-side cache TTL (time-to-live) in milliseconds
   * Default: 5 minutes (300,000ms)
   * 
   * Cached responses are reused for identical requests within this window.
   * Should match or exceed MIN_CALL_INTERVAL for best results.
   */
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  /**
   * Maximum number of cached responses to keep in memory
   * Default: 100
   * 
   * Old entries are automatically cleaned when this limit is reached.
   */
  MAX_CACHE_SIZE: 100,
} as const;

/**
 * Calculate expected daily API call volume
 */
export function getExpectedDailyCallVolume(): number {
  const callsPerHour = (60 * 60 * 1000) / AI_RATE_LIMITS.MIN_CALL_INTERVAL;
  const callsPerDay = callsPerHour * 24;
  return Math.ceil(callsPerDay);
}

/**
 * Get human-readable rate limit info
 */
export function getRateLimitInfo() {
  const minutes = AI_RATE_LIMITS.MIN_CALL_INTERVAL / 60000;
  const callsPerDay = getExpectedDailyCallVolume();
  
  return {
    intervalMinutes: minutes,
    maxCallsPerDay: callsPerDay,
    cacheMinutes: AI_RATE_LIMITS.CACHE_TTL / 60000,
  };
}
