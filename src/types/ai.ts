export interface DisasterEventContext {
  eventId: string;
  hazardType: string;
  severity: number;
  magnitude?: number;
  customerDensity: number;
  location: {
    lat: number;
    lng: number;
    label?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ClaimForecastInsight {
  eventId: string;
  summary: string;
  expectedClaimsRange: string;
  adjusterRecommendation: string;
  riskDrivers: string[];
}

export interface ClaimForecastResponse {
  generatedAt: string;
  model: string;
  insights: ClaimForecastInsight[];
}

export interface SocialMentionPayload {
  postId: string;
  platform: string;
  text: string;
  location?: {
    lat: number;
    lng: number;
  };
  timestamp: string;
}

export interface SentimentInsight {
  postId: string;
  platform: string;
  sentimentLabel: "positive" | "neutral" | "negative";
  panicScore: number;
  summary: string;
}

export interface SentimentHotspot {
  lat: number;
  lng: number;
  panicIndex: number;
  mentions: number;
}

export interface SentimentAnalysisResponse {
  generatedAt: string;
  model: string;
  overallSentiment: "positive" | "neutral" | "negative";
  panicLevel: "low" | "moderate" | "high";
  hotspots: SentimentHotspot[];
  insights: SentimentInsight[];
}
