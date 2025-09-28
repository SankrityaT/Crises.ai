export interface NormalizedSocialMention {
  id: string;
  platform: string;
  content: string;
  sentimentScore: number;
  mentionCount?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
  capturedAt: string;
  metadata?: Record<string, unknown>;
}
