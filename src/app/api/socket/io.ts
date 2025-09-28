import type { Server as HTTPServer } from "node:http";

import { Server as SocketIOServer } from "socket.io";

import { createClient } from "redis";

type RedisSubscriber = ReturnType<typeof createClient>;

import type { PersistedEvent } from "../../../../types/events";
import {
  SOCKET_CHANNELS,
  onMapEvents,
  offMapEvents,
  onRapidClusters,
  offRapidClusters,
  onSocialHotspots,
  offSocialHotspots,
  onPredictions,
  offPredictions,
  type MapEventPayload,
  type RapidClusterPayload,
  type SocialSentimentPayload,
  type PredictionPayload,
  type SocketPayload,
} from "../../../../backend/services/socketEmitter";

interface ServerToClientEvents {
  "map.events": (payload: MapEventPayload) => void;
  "map.rapid": (payload: RapidClusterPayload) => void;
  "map.social": (payload: SocialSentimentPayload) => void;
  "map.predictions": (payload: PredictionPayload) => void;
}

interface ClientToServerEvents {
  "client:ready": () => void;
  "client:ping": () => void;
}

type InterServerEvents = Record<string, never>;

interface SocketData {
  lastSeenEventId?: string;
}

const globalRefs = globalThis as unknown as {
  io?: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  mapListener?: (payload: MapEventPayload) => void;
  rapidListener?: (payload: RapidClusterPayload) => void;
  socialListener?: (payload: SocialSentimentPayload) => void;
  predictionListener?: (payload: PredictionPayload) => void;
  redisSubscriber?: RedisSubscriber;
};

async function ensureRedisSubscriber(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): Promise<void> {
  if (!process.env.REDIS_URL || globalRefs.redisSubscriber) {
    return;
  }

  try {
    const subscriber = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_TOKEN,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 2_000),
      },
    });

    subscriber.on("error", (error) => {
      console.warn("[Socket][Subscriber] Redis error", error);
    });

    await subscriber.connect();

    await Promise.all(
      Object.values(SOCKET_CHANNELS).map((channel) =>
        subscriber.subscribe(channel, (message) => {
          try {
            const payload = JSON.parse(message) as SocketPayload;
            if (!payload?.kind) return;
            io.emit(payload.kind, payload as never);
          } catch (error) {
            console.warn("[Socket][Subscriber] Failed to parse payload", error);
          }
        })
      )
    );

    globalRefs.redisSubscriber = subscriber;
  } catch (error) {
    console.warn("[Socket][Subscriber] Failed to connect to Redis", error);
  }
}

function attachLocalEmitterBridge(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  if (process.env.REDIS_URL) {
    return;
  }

  if (!globalRefs.mapListener) {
    const mapListener = (payload: MapEventPayload) => {
      io.emit(SOCKET_CHANNELS.MAP_EVENTS, payload);
    };
    onMapEvents(mapListener);
    globalRefs.mapListener = mapListener;
  }

  if (!globalRefs.rapidListener) {
    const rapidListener = (payload: RapidClusterPayload) => {
      io.emit(SOCKET_CHANNELS.RAPID_CALLS, payload);
    };
    onRapidClusters(rapidListener);
    globalRefs.rapidListener = rapidListener;
  }

  if (!globalRefs.socialListener) {
    const socialListener = (payload: SocialSentimentPayload) => {
      io.emit(SOCKET_CHANNELS.SOCIAL_HOTSPOTS, payload);
    };
    onSocialHotspots(socialListener);
    globalRefs.socialListener = socialListener;
  }

  if (!globalRefs.predictionListener) {
    const predictionListener = (payload: PredictionPayload) => {
      io.emit(SOCKET_CHANNELS.PREDICTIONS, payload);
    };
    onPredictions(predictionListener);
    globalRefs.predictionListener = predictionListener;
  }
}

function registerConnectionLogging(
  io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  io.on("connection", (socket) => {
    console.log("[Socket] Client connected", socket.id);

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Client disconnected", socket.id, reason);
    });

    socket.on("client:ready", () => {
      console.log("[Socket] Client ready", socket.id);
    });

    socket.on("client:ping", () => {
      const payload: MapEventPayload = {
        kind: SOCKET_CHANNELS.MAP_EVENTS,
        events: [] as PersistedEvent[],
        emittedAt: new Date().toISOString(),
      };

      socket.emit(SOCKET_CHANNELS.MAP_EVENTS, payload);
    });
  });
}

export function initSocketServer(
  server: HTTPServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  if (!globalRefs.io) {
    const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
      server,
      {
        path: "/api/socket/io",
        cors: {
          origin: process.env.NEXT_PUBLIC_WS_URL ?? "*",
        },
      }
    );

    attachLocalEmitterBridge(io);
    void ensureRedisSubscriber(io);
    registerConnectionLogging(io);

    globalRefs.io = io;
  }

  return globalRefs.io;
}

export async function shutdownSocketServer(): Promise<void> {
  if (globalRefs.io) {
    await globalRefs.io.close();
    globalRefs.io = undefined;
  }

  if (globalRefs.mapListener) {
    offMapEvents(globalRefs.mapListener);
    globalRefs.mapListener = undefined;
  }

  if (globalRefs.rapidListener) {
    offRapidClusters(globalRefs.rapidListener);
    globalRefs.rapidListener = undefined;
  }

  if (globalRefs.socialListener) {
    offSocialHotspots(globalRefs.socialListener);
    globalRefs.socialListener = undefined;
  }

  if (globalRefs.predictionListener) {
    offPredictions(globalRefs.predictionListener);
    globalRefs.predictionListener = undefined;
  }

  if (globalRefs.redisSubscriber) {
    try {
      await globalRefs.redisSubscriber.quit();
    } catch (error) {
      console.warn("[Socket] Failed to quit Redis subscriber", error);
    }
    globalRefs.redisSubscriber = undefined;
  }
}
