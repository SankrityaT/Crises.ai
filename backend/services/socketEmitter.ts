import { EventEmitter } from "node:events";

import type { RedisClientType } from "redis";

import type { PersistedEvent } from "../../types/events";
import type {
  PredictionSummary,
  RapidCallCluster,
  SocialHotspot,
} from "../../src/types/map";

export interface MapEventPayload {
  kind: "map.events";
  events: PersistedEvent[];
  emittedAt: string;
}

export interface RapidClusterPayload {
  kind: "map.rapid";
  clusters: RapidCallCluster[];
  emittedAt: string;
}

export interface SocialSentimentPayload {
  kind: "map.social";
  hotspots: SocialHotspot[];
  emittedAt: string;
}

export interface PredictionPayload {
  kind: "map.predictions";
  predictions: PredictionSummary[];
  emittedAt: string;
}

export type SocketPayload =
  | MapEventPayload
  | RapidClusterPayload
  | SocialSentimentPayload
  | PredictionPayload;

export const SOCKET_CHANNELS = {
  MAP_EVENTS: "map.events",
  RAPID_CALLS: "map.rapid",
  SOCIAL_HOTSPOTS: "map.social",
  PREDICTIONS: "map.predictions",
} as const;

type ChannelName = (typeof SOCKET_CHANNELS)[keyof typeof SOCKET_CHANNELS];

type EventListener<T> = (payload: T) => void;

const emitter = new EventEmitter();

let publishFn: ((channel: ChannelName, payload: SocketPayload) => Promise<void>) | null = null;
let redisPublisher: RedisClientType | null = null;

async function getRedisPublisher(): Promise<RedisClientType | null> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  try {
    const { createClient } = await import("redis");
    redisPublisher = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 1_000),
      },
      password: process.env.REDIS_TOKEN,
    });

    if (!redisPublisher.isOpen) {
      await redisPublisher.connect();
    }

    return redisPublisher;
  } catch (error) {
    console.warn("[SocketEmitter] Failed to initialize Redis publisher", error);
    return null;
  }
}

async function ensurePublishFn(): Promise<
  (channel: ChannelName, payload: SocketPayload) => Promise<void>
> {
  if (publishFn) {
    return publishFn;
  }

  const redis = redisPublisher ?? (await getRedisPublisher());

  publishFn = async (channel: ChannelName, payload: SocketPayload) => {
    emitter.emit(channel, payload);

    if (redis) {
      try {
        await redis.publish(channel, JSON.stringify(payload));
      } catch (error) {
        console.warn(
          `[SocketEmitter] Failed to publish payload to Redis channel ${channel}`,
          error
        );
      }
    }
  };

  return publishFn;
}

export async function publishMapEvents(events: PersistedEvent[]): Promise<void> {
  const channel = SOCKET_CHANNELS.MAP_EVENTS;
  const payload: MapEventPayload = {
    kind: channel,
    events,
    emittedAt: new Date().toISOString(),
  };

  const publish = await ensurePublishFn();
  await publish(channel, payload);
}

export function onMapEvents(listener: EventListener<MapEventPayload>): void {
  emitter.on(SOCKET_CHANNELS.MAP_EVENTS, listener);
}

export function offMapEvents(listener: EventListener<MapEventPayload>): void {
  emitter.off(SOCKET_CHANNELS.MAP_EVENTS, listener);
}

export async function publishRapidClusters(
  clusters: RapidCallCluster[]
): Promise<void> {
  const channel = SOCKET_CHANNELS.RAPID_CALLS;
  const payload: RapidClusterPayload = {
    kind: channel,
    clusters,
    emittedAt: new Date().toISOString(),
  };

  const publish = await ensurePublishFn();
  await publish(channel, payload);
}

export function onRapidClusters(
  listener: EventListener<RapidClusterPayload>
): void {
  emitter.on(SOCKET_CHANNELS.RAPID_CALLS, listener);
}

export function offRapidClusters(
  listener: EventListener<RapidClusterPayload>
): void {
  emitter.off(SOCKET_CHANNELS.RAPID_CALLS, listener);
}

export async function publishSocialHotspots(
  hotspots: SocialHotspot[]
): Promise<void> {
  const channel = SOCKET_CHANNELS.SOCIAL_HOTSPOTS;
  const payload: SocialSentimentPayload = {
    kind: channel,
    hotspots,
    emittedAt: new Date().toISOString(),
  };

  const publish = await ensurePublishFn();
  await publish(channel, payload);
}

export function onSocialHotspots(
  listener: EventListener<SocialSentimentPayload>
): void {
  emitter.on(SOCKET_CHANNELS.SOCIAL_HOTSPOTS, listener);
}

export function offSocialHotspots(
  listener: EventListener<SocialSentimentPayload>
): void {
  emitter.off(SOCKET_CHANNELS.SOCIAL_HOTSPOTS, listener);
}

export async function publishPredictions(
  predictions: PredictionSummary[]
): Promise<void> {
  const channel = SOCKET_CHANNELS.PREDICTIONS;
  const payload: PredictionPayload = {
    kind: channel,
    predictions,
    emittedAt: new Date().toISOString(),
  };

  const publish = await ensurePublishFn();
  await publish(channel, payload);
}

export function onPredictions(
  listener: EventListener<PredictionPayload>
): void {
  emitter.on(SOCKET_CHANNELS.PREDICTIONS, listener);
}

export function offPredictions(
  listener: EventListener<PredictionPayload>
): void {
  emitter.off(SOCKET_CHANNELS.PREDICTIONS, listener);
}

export function removeAllListeners(): void {
  emitter.removeAllListeners();
}

export async function shutdownSocketEmitter(): Promise<void> {
  emitter.removeAllListeners();
  publishFn = null;

  if (redisPublisher) {
    try {
      await redisPublisher.quit();
    } catch (error) {
      console.warn("[SocketEmitter] Failed to quit Redis client", error);
    } finally {
      redisPublisher = null;
    }
  }
}
