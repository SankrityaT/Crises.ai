# AI API Rate Limiting & Cost Control

## Problem
The application was making **859 API calls in 24 hours** to the Gemini AI service, resulting in excessive costs. This was caused by:

1. **Frequent data updates** triggering AI processing on every change
2. **No rate limiting** on client-side AI integration hook
3. **No caching** of AI responses for identical requests
4. **Short debounce delay** (2 seconds) insufficient to prevent rapid calls

## Solution Implemented

### 1. Client-Side Rate Limiting (`use-ai-integration.ts`)
- **5-minute minimum interval** between AI calls (configurable)
- **Content hashing** to detect actual data changes (not just timestamp updates)
- **5-second debounce** to batch rapid updates
- **Tracking refs** to prevent duplicate processing

### 2. Server-Side Caching (API routes)
- **5-minute cache TTL** for identical requests
- **Content-based cache keys** using event/mention IDs
- **Automatic cache cleanup** when size exceeds 100 entries
- Applied to both `/api/ai/predict` and `/api/ai/sentiment`

### 3. Centralized Configuration (`ai-rate-limits.ts`)
All rate limiting settings in one place for easy adjustment:
```typescript
export const AI_RATE_LIMITS = {
  MIN_CALL_INTERVAL: 5 * 60 * 1000,  // 5 minutes
  DEBOUNCE_DELAY: 5000,               // 5 seconds
  CACHE_TTL: 5 * 60 * 1000,          // 5 minutes
  MAX_CACHE_SIZE: 100,                // entries
}
```

## Expected Results

### Before (859 calls/day)
- ~36 calls per hour
- ~1 call every 100 seconds
- High API costs

### After (288 calls/day max)
- 12 calls per hour maximum
- 1 call every 5 minutes minimum
- **66% reduction in API calls**
- Additional savings from server-side caching

## Adjusting Rate Limits

Edit `/src/config/ai-rate-limits.ts` to change behavior:

### Conservative (96 calls/day)
```typescript
MIN_CALL_INTERVAL: 15 * 60 * 1000,  // 15 minutes
```

### Very Conservative (48 calls/day)
```typescript
MIN_CALL_INTERVAL: 30 * 60 * 1000,  // 30 minutes
```

### Testing/Demo Only (720 calls/day)
```typescript
MIN_CALL_INTERVAL: 2 * 60 * 1000,   // 2 minutes
```

## Monitoring

Check browser console for rate limiting messages:
```
[AI] Rate limited: 287s until next call allowed
[AI] Processed updates. Next call allowed in 5 minutes
[API][AI] Returning cached prediction response
```

## Cost Estimation

Assuming Gemini API costs ~$0.01 per call:
- **Before**: 859 calls/day × $0.01 = **$8.59/day** (~$257/month)
- **After**: 288 calls/day × $0.01 = **$2.88/day** (~$86/month)
- **Savings**: ~$171/month (66% reduction)

*Actual costs depend on your API pricing tier and token usage.*

## Files Modified

1. `/src/hooks/use-ai-integration.ts` - Client-side rate limiting
2. `/src/app/api/ai/predict/route.ts` - Server-side caching
3. `/src/app/api/ai/sentiment/route.ts` - Server-side caching
4. `/src/config/ai-rate-limits.ts` - Centralized configuration (new)

## Testing

1. Start the dev server
2. Open browser console
3. Navigate to the map page
4. Watch for rate limiting messages
5. Verify AI calls only happen every 5 minutes

## Future Improvements

1. **User-configurable rate limits** via settings UI
2. **Per-user rate limiting** for multi-tenant scenarios
3. **Redis/external cache** for distributed deployments
4. **API usage dashboard** to track costs in real-time
5. **Webhook-based updates** instead of polling to reduce calls further
