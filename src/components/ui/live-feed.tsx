"use client";

import { useMapStore } from "@/store/map-store";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { getTimeAgo, getSeverityColor } from "@/lib/utils";
import { 
  Activity, 
  Phone, 
  MessageSquare, 
  Zap,
  MapPin
} from "lucide-react";
import { useMemo } from "react";

interface FeedItem {
  id: string;
  title: string;
  type: "event" | "rapidCall" | "social";
  severity?: string;
  time: string;
  source: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export function LiveFeed() {
  const { events, rapidCalls, socialHotspots, filters } = useMapStore();

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    // Add events
    if (filters.showEvents) {
      events.forEach(event => {
        items.push({
          id: event.id,
          title: event.title,
          type: "event",
          severity: event.severity,
          time: event.startedAt,
          source: event.source.toUpperCase(),
          icon: Zap,
          color: getSeverityColor(event.severity)
        });
      });
    }

    // Add rapid calls
    if (filters.showRapidCalls) {
      rapidCalls.forEach(call => {
        items.push({
          id: call.id,
          title: `${call.incidentType} - ${call.volume} calls`,
          type: "rapidCall",
          time: call.lastUpdated,
          source: "911",
          icon: Phone,
          color: "#EA580C"
        });
      });
    }

    // Add social hotspots
    if (filters.showSocialHotspots) {
      socialHotspots.forEach(hotspot => {
        const sentimentLabel = hotspot.sentimentScore < 0.3 ? 'Negative' :
                              hotspot.sentimentScore < 0.6 ? 'Neutral' : 'Positive';
        items.push({
          id: hotspot.id,
          title: `Social activity - ${hotspot.mentionCount} mentions`,
          type: "social",
          severity: sentimentLabel.toLowerCase(),
          time: hotspot.lastUpdated,
          source: "SOCIAL",
          icon: MessageSquare,
          color: hotspot.sentimentScore < 0.3 ? '#DC2626' : 
                 hotspot.sentimentScore < 0.6 ? '#D97706' : '#65A30D'
        });
      });
    }

    // Sort by time (most recent first)
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [events, rapidCalls, socialHotspots, filters]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-4 border-b border-[var(--card-border)]">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
            <Activity className="h-5 w-5 text-[var(--accent-primary)]" />
          </div>
          <span>Live Activity Feed</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="overflow-y-auto h-full">
          {feedItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--hover-bg)] flex items-center justify-center">
                <Activity className="h-8 w-8 text-[var(--text-muted)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No active events</p>
              <p className="text-xs text-[var(--text-muted)]">Enable data layers to see live updates</p>
            </div>
          ) : (
            <div>
              {feedItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`p-4 border-l-4 hover:bg-[var(--hover-bg)] transition-all duration-200 cursor-pointer ${
                      index !== feedItems.length - 1 ? 'border-b border-[var(--card-border)]' : ''
                    }`}
                    style={{ borderLeftColor: item.color }}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: `${item.color}15`, color: item.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">
                            {item.title}
                          </p>
                          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap font-medium">
                            {getTimeAgo(item.time)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className="text-xs px-2 py-0.5 h-auto border-[var(--card-border)] text-[var(--text-secondary)]"
                          >
                            {item.source}
                          </Badge>
                          
                          {item.severity && (
                            <Badge 
                              variant={
                                item.severity === 'critical' ? 'critical' :
                                item.severity === 'high' ? 'high' :
                                item.severity === 'moderate' ? 'moderate' :
                                item.severity === 'low' ? 'low' : 'secondary'
                              }
                              className="text-xs px-2 py-0.5 h-auto font-semibold"
                            >
                              {item.severity}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
