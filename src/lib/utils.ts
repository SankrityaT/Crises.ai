import { type ClassValue, clsx } from "clsx";
import { type EventSeverity } from "@/types/map";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function getSeverityColor(severity: EventSeverity): string {
  switch (severity) {
    case "critical":
      return "#DC2626"; // red-600
    case "high":
      return "#EA580C"; // orange-600
    case "moderate":
      return "#D97706"; // amber-600
    case "low":
      return "#65A30D"; // lime-600
    default:
      return "#6B7280"; // gray-500
  }
}

export function formatClaimsAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters.toFixed(0)} m`;
}

export function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffInSeconds / 86400);
  return `${days}d ago`;
}
