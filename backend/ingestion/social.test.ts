import { describe, expect, it } from "vitest";

import {
  mentionToEvent,
  normalizeMention,
  sentimentToSeverity,
  toHotspot,
  SocialMentionRecord,
} from "./social";

const record: SocialMentionRecord = {
  id: "mention_1",
  platform: "twitter",
  content: "Power outage reported downtown",
  sentiment_score: -0.5,
  mention_count: 30,
  latitude: 41.88,
  longitude: -87.63,
  captured_at: "2025-09-28T02:25:00.000Z",
};

describe("Social normalization", () => {
  it("maps sentiment score to severity bucket", () => {
    expect(sentimentToSeverity(-0.7)).toBe("critical");
    expect(sentimentToSeverity(-0.4)).toBe("high");
    expect(sentimentToSeverity(0.5)).toBe("low");
  });

  it("normalizes raw mention", () => {
    const mention = normalizeMention(record);

    expect(mention).toMatchObject({
      id: "mention_1",
      platform: "twitter",
      sentimentScore: -0.5,
    });
  });

  it("converts mention to event only when coordinates available", () => {
    const mention = normalizeMention(record);
    const event = mentionToEvent(mention);

    expect(event).not.toBeNull();

    const incomplete = normalizeMention({ ...record, latitude: undefined, longitude: undefined });
    expect(mentionToEvent(incomplete)).toBeNull();
  });

  it("creates hotspot payload from mention", () => {
    const hotspot = toHotspot(normalizeMention(record));
    expect(hotspot).toMatchObject({ id: "mention_1", mentionCount: 30 });
  });
});
