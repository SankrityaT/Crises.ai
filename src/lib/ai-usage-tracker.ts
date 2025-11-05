/**
 * AI API Usage Tracker
 * 
 * Tracks API call statistics to help monitor costs and usage patterns.
 * Data is stored in localStorage for persistence across sessions.
 */

interface UsageStats {
  totalCalls: number;
  lastCallTime: number;
  callsToday: number;
  todayDate: string;
  callHistory: Array<{ timestamp: number; endpoint: string }>;
}

const STORAGE_KEY = 'ai-usage-stats';
const MAX_HISTORY_LENGTH = 1000;

class AIUsageTracker {
  private stats: UsageStats;

  constructor() {
    this.stats = this.loadStats();
  }

  private loadStats(): UsageStats {
    if (typeof window === 'undefined') {
      return this.getDefaultStats();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UsageStats;
        
        // Reset daily counter if it's a new day
        const today = new Date().toISOString().split('T')[0];
        if (parsed.todayDate !== today) {
          parsed.callsToday = 0;
          parsed.todayDate = today;
        }
        
        return parsed;
      }
    } catch (error) {
      console.error('[Usage Tracker] Failed to load stats:', error);
    }

    return this.getDefaultStats();
  }

  private getDefaultStats(): UsageStats {
    return {
      totalCalls: 0,
      lastCallTime: 0,
      callsToday: 0,
      todayDate: new Date().toISOString().split('T')[0],
      callHistory: [],
    };
  }

  private saveStats(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (error) {
      console.error('[Usage Tracker] Failed to save stats:', error);
    }
  }

  /**
   * Record an API call
   */
  recordCall(endpoint: 'predict' | 'sentiment'): void {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Reset daily counter if new day
    if (this.stats.todayDate !== today) {
      this.stats.callsToday = 0;
      this.stats.todayDate = today;
    }

    this.stats.totalCalls++;
    this.stats.callsToday++;
    this.stats.lastCallTime = now;
    
    this.stats.callHistory.push({ timestamp: now, endpoint });
    
    // Trim history if too long
    if (this.stats.callHistory.length > MAX_HISTORY_LENGTH) {
      this.stats.callHistory = this.stats.callHistory.slice(-MAX_HISTORY_LENGTH);
    }

    this.saveStats();
  }

  /**
   * Get current usage statistics
   */
  getStats(): UsageStats {
    return { ...this.stats };
  }

  /**
   * Get calls in the last N hours
   */
  getCallsInLastHours(hours: number): number {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.stats.callHistory.filter(call => call.timestamp > cutoff).length;
  }

  /**
   * Get estimated cost (assuming $0.01 per call)
   */
  getEstimatedCost(pricePerCall: number = 0.01): {
    today: number;
    total: number;
    last24h: number;
  } {
    return {
      today: this.stats.callsToday * pricePerCall,
      total: this.stats.totalCalls * pricePerCall,
      last24h: this.getCallsInLastHours(24) * pricePerCall,
    };
  }

  /**
   * Get time since last call in milliseconds
   */
  getTimeSinceLastCall(): number {
    if (this.stats.lastCallTime === 0) return Infinity;
    return Date.now() - this.stats.lastCallTime;
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats = this.getDefaultStats();
    this.saveStats();
  }

  /**
   * Get usage summary for display
   */
  getSummary(): string {
    const timeSince = this.getTimeSinceLastCall();
    const minutesSince = Math.floor(timeSince / 60000);
    const last24h = this.getCallsInLastHours(24);
    const cost = this.getEstimatedCost();

    return `
AI API Usage Summary:
- Today: ${this.stats.callsToday} calls ($${cost.today.toFixed(2)})
- Last 24h: ${last24h} calls ($${cost.last24h.toFixed(2)})
- Total: ${this.stats.totalCalls} calls ($${cost.total.toFixed(2)})
- Last call: ${minutesSince === Infinity ? 'Never' : `${minutesSince} minutes ago`}
    `.trim();
  }
}

// Singleton instance
export const aiUsageTracker = new AIUsageTracker();

// Export for debugging in console
if (typeof window !== 'undefined') {
  (window as any).__aiUsageTracker = aiUsageTracker;
}
