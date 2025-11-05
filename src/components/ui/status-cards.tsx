"use client";

import { useMapStore } from "@/store/map-store";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { formatClaimsAmount, getTimeAgo } from "@/lib/utils";

export function StatusCards() {
  const { 
    events, 
    rapidCalls, 
    socialHotspots, 
    predictions,
    getTotalPredictedClaims,
    getTotalAdjustersNeeded,
    lastUpdated,
    isLoading
  } = useMapStore();

  const totalEvents = events?.length || 0;
  const totalCalls = rapidCalls?.reduce((sum, call) => {
    const count = call.callCount || call.volume || 0;
    return sum + (typeof count === 'number' && !isNaN(count) ? count : 0);
  }, 0) || 0;
  const totalMentions = socialHotspots?.reduce((sum, hotspot) => {
    const mentions = hotspot.mentionCount || 0;
    return sum + (typeof mentions === 'number' && !isNaN(mentions) ? mentions : 0);
  }, 0) || 0;
  const totalClaims = getTotalPredictedClaims();
  const totalAdjusters = getTotalAdjustersNeeded();

  const criticalEvents = events?.filter(e => e?.severity === 'critical').length || 0;
  const highEvents = events?.filter(e => e?.severity === 'high').length || 0;
  
  // Include rapid calls in high priority zones calculation
  const criticalRapidCalls = rapidCalls?.filter(call => call?.severity === 'critical').length || 0;
  const highRapidCalls = rapidCalls?.filter(call => call?.severity === 'high').length || 0;
  
  const highPriorityZones = criticalEvents + highEvents + criticalRapidCalls + highRapidCalls;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-4">
              <div className="h-6 bg-[var(--hover-bg)] rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-8 bg-[var(--hover-bg)] rounded w-1/2"></div>
                <div className="h-4 bg-[var(--hover-bg)] rounded w-full"></div>
                <div className="h-4 bg-[var(--hover-bg)] rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Disaster Pulse */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <div className="w-6 h-6 border-2 border-white rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-[var(--text-primary)] leading-tight mb-1">Disaster Pulse</h3>
              <p className="text-[var(--text-secondary)] text-sm font-medium leading-normal">
                Real-time emergency monitoring
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">LIVE</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-[var(--hover-bg)] rounded-xl p-5 border border-[var(--card-border)] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[var(--text-secondary)] font-medium text-base">Active Events</span>
                <span className="text-4xl font-bold text-[var(--text-primary)] tabular-nums">{totalEvents}</span>
              </div>
              {criticalEvents > 0 && (
                <div className="flex justify-end">
                  <Badge className="bg-red-600 text-white border-0 px-3 py-1 text-xs font-semibold">
                    {criticalEvents} Critical
                  </Badge>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--hover-bg)] rounded-xl p-5 border border-[var(--card-border)] shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0"></div>
                  <span className="text-[var(--text-secondary)] text-sm font-medium">911 Calls</span>
                </div>
                <div className="text-orange-500 text-3xl font-bold tabular-nums">{totalCalls}</div>
              </div>
              
              <div className="bg-[var(--hover-bg)] rounded-xl p-5 border border-[var(--card-border)] shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <span className="text-[var(--text-secondary)] text-sm font-medium">Social Mentions</span>
                </div>
                <div className="text-blue-500 text-3xl font-bold tabular-nums">{totalMentions}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] pt-2 border-t border-[var(--card-border)]">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Last updated {lastUpdated ? getTimeAgo(lastUpdated) : 'just now'}
            </div>
          </div>
        </div>
      </Card>

      {/* Predicted Claims */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <div className="text-white text-xl font-bold">$</div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-[var(--text-primary)] leading-tight mb-1">Predicted Claims</h3>
              <p className="text-[var(--text-secondary)] text-sm font-medium leading-normal">
                AI-powered financial forecasting
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">AI</span>
            </div>
          </div>
          
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-green-500 mb-4 tracking-tight tabular-nums">
              {formatClaimsAmount(totalClaims)}
            </div>
            <div className="text-[var(--text-primary)] font-medium text-base mb-2">Expected in next 24h</div>
            <div className="text-xs text-[var(--text-muted)] mb-4">
              Based on {totalCalls} emergency calls and {predictions.length} active predictions
            </div>
            <div className="w-20 h-1 bg-green-500 rounded-full mx-auto"></div>
          </div>
          
          {predictions.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--text-primary)] font-medium border-b border-[var(--card-border)] pb-2">Top Predictions</div>
              {predictions.slice(0, 3).map((pred) => (
                <div key={pred.id} className="bg-[var(--hover-bg)] rounded-xl p-4 border border-[var(--card-border)] shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-secondary)] text-sm font-medium truncate flex-1 mr-4">
                      {pred.label.length > 25 ? `${pred.label.substring(0, 25)}...` : pred.label}
                    </span>
                    <span className="text-green-500 font-bold text-lg flex-shrink-0 tabular-nums">
                      {formatClaimsAmount(pred.expectedClaims)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Adjuster Deployment */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <div className="w-6 h-6 border-2 border-white rounded-sm"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-[var(--text-primary)] leading-tight mb-1">Adjuster Deployment</h3>
              <p className="text-[var(--text-secondary)] text-sm font-medium leading-normal">
                Resource allocation & dispatch
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">ACTIVE</span>
            </div>
          </div>
          
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-blue-500 mb-4 tracking-tight tabular-nums">{totalAdjusters}</div>
            <div className="text-[var(--text-primary)] font-medium text-base mb-4">Adjusters needed</div>
            <div className="w-20 h-1 bg-blue-500 rounded-full mx-auto"></div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-[var(--hover-bg)] rounded-xl p-5 border border-[var(--card-border)] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[var(--text-secondary)] font-medium text-base">High Priority Zones</span>
                <span className="text-[var(--text-primary)] font-bold text-2xl tabular-nums">{highPriorityZones}</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[var(--text-secondary)] font-medium text-base">Deployment Status</span>
                    <span className="text-xs text-[var(--text-muted)]">Adjusters per high-priority zone</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[var(--text-primary)] font-bold text-xl tabular-nums block">
                      {totalAdjusters > 0 && highPriorityZones > 0 ? 
                        `${(totalAdjusters / highPriorityZones).toFixed(1)}` : 
                        totalAdjusters > 0 ? totalAdjusters : '0'
                      }
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {highPriorityZones > 0 ? 'per zone' : 'available'}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-[var(--card-border)] rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500" 
                    style={{ width: `${totalAdjusters > 0 ? Math.round((totalAdjusters / (totalAdjusters + highPriorityZones)) * 100) : 75}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {highPriorityZones > 0 && (
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-5 h-5 bg-orange-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-[var(--text-primary)] font-semibold leading-relaxed block mb-2">
                      High demand detected in {highPriorityZones} zones
                    </span>
                    <div className="text-xs text-[var(--text-secondary)] space-y-1">
                      {criticalEvents > 0 && <div>• {criticalEvents} critical events</div>}
                      {highEvents > 0 && <div>• {highEvents} high severity events</div>}
                      {criticalRapidCalls > 0 && <div>• {criticalRapidCalls} critical 911 clusters</div>}
                      {highRapidCalls > 0 && <div>• {highRapidCalls} high priority 911 clusters</div>}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
