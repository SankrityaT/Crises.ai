import { sql } from "drizzle-orm";

import { getDb, isDatabaseConfigured, schema } from "./db";
import type { NormalizedSocialMention } from "../../types/social";

export async function upsertSocialMentions(
  mentions: NormalizedSocialMention[]
): Promise<void> {
  if (!mentions.length) {
    return;
  }

  if (!isDatabaseConfigured()) {
    console.warn(
      "[Repository][Social] DATABASE_URL not set. Skipping persistence for %d mentions.",
      mentions.length
    );
    return;
  }

  const db = getDb();

  for (const mention of mentions) {
    const row = {
      id: mention.id,
      platform: mention.platform,
      content: mention.content,
      sentimentScore: mention.sentimentScore,
      mentionCount: mention.mentionCount ?? null,
      latitude: mention.coordinates?.latitude ?? null,
      longitude: mention.coordinates?.longitude ?? null,
      capturedAt: new Date(mention.capturedAt),
      metadata: mention.metadata ?? null,
      createdAt: new Date(),
    } satisfies typeof schema.socialMentions.$inferInsert;

    await db
      .insert(schema.socialMentions)
      .values(row)
      .onConflictDoUpdate({
        target: schema.socialMentions.id,
        set: {
          platform: row.platform,
          content: row.content,
          sentimentScore: row.sentimentScore,
          mentionCount: row.mentionCount,
          latitude: row.latitude,
          longitude: row.longitude,
          capturedAt: row.capturedAt,
          metadata: row.metadata,
          createdAt: sql`least(${schema.socialMentions.createdAt}, ${row.createdAt})`,
        },
      });
  }
}
