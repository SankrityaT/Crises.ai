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
    <Card className="bg-gray-900 border-gray-700 text-gray-100 flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl text-gray-100">
          <Activity className="h-6 w-6 text-gray-100" />
          Live Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <div className="overflow-y-auto h-full">
          {feedItems.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active events</p>
              <p className="text-xs">Enable layers to see live updates</p>
            </div>
          ) : (
            <div className="space-y-1">
              {feedItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`p-3 border-l-4 hover:bg-gray-800 transition-colors ${
                      index !== feedItems.length - 1 ? 'border-b border-gray-700' : ''
                    }`}
                    style={{ borderLeftColor: item.color }}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="p-1.5 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${item.color}20`, color: item.color }}
                      >
                        <Icon className="h-3 w-3" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-100 truncate">
                            {item.title}
                          </p>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {getTimeAgo(item.time)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs px-1.5 py-0.5 h-auto"
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
                              className="text-xs px-1.5 py-0.5 h-auto"
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
