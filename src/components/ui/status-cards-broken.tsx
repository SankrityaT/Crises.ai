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

  const totalEvents = events.length;
  const totalCalls = rapidCalls.reduce((sum, call) => sum + (call.callCount || call.volume || 0), 0);
  const totalMentions = socialHotspots.reduce((sum, hotspot) => sum + hotspot.mentionCount, 0);
  const totalClaims = getTotalPredictedClaims();
  const totalAdjusters = getTotalAdjustersNeeded();

  const criticalEvents = events.filter(e => e.severity === 'critical').length;
  const highEvents = events.filter(e => e.severity === 'high').length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse bg-gray-900 border-gray-700">
            <CardHeader className="pb-4">
              <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-8 bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-2/3"></div>
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
      <Card className="bg-gray-900 border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <div className="w-6 h-6 border-2 border-white rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-white leading-tight mb-1">Disaster Pulse</h3>
              <p className="text-red-200 text-sm font-medium leading-tight">Real-time<br />emergency<br />monitoring</p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400 font-medium">LIVE</span>
          
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 font-medium text-base">Active Events</span>
                <span className="text-4xl font-bold text-white tabular-nums">{totalEvents}</span>
              </div>
              {criticalEvents > 0 && (
                <div className="flex justify-end">
                  <Badge className="bg-red-600 text-white border-0 px-3 py-1 text-xs font-semibold">
                    {criticalEvents} Critical
                  </Badge>
                  {highEvents > 0 && (
                    <Badge className="bg-orange-600 text-white border-0 px-3 py-1 text-xs font-semibold ml-2">
                      {highEvents} High
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:bg-gray-800/70 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-orange-400 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-300 text-sm font-medium">911 Calls</span>
                </div>
                <div className="text-orange-400 text-3xl font-bold tabular-nums">{totalCalls}</div>
              </div>
              
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:bg-gray-800/70 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-300 text-sm font-medium">Social Mentions</span>
                </div>
                <div className="text-blue-400 text-3xl font-bold tabular-nums">{totalMentions}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 pt-2 border-t border-gray-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Last updated {lastUpdated ? getTimeAgo(lastUpdated) : 'just now'}
            </div>
          </div>
        </div>
      </Card>

      {/* Predicted Claims */}
      <Card className="bg-gray-900 border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <div className="text-white text-xl font-bold">$</div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-white leading-tight mb-1">Predicted Claims</h3>
              <p className="text-green-200 text-sm font-medium leading-tight">AI-powered<br />financial<br />forecasting</p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400 font-medium">AI</span>
            </div>
          </div>
          
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-green-400 mb-4 tracking-tight tabular-nums">
              {formatClaimsAmount(totalClaims)}
            </div>
            <div className="text-gray-300 font-medium text-base mb-4">Expected in next 24h</div>
            <div className="w-20 h-1 bg-green-500 rounded-full mx-auto"></div>
          </div>
          
          {predictions.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-gray-400 font-medium border-b border-gray-700 pb-2">Top Predictions</div>
              {predictions.slice(0, 3).map((pred) => (
                <div key={pred.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:bg-gray-800/70 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-200 text-sm font-medium truncate flex-1 mr-4">{pred.label}</span>
                    <span className="text-green-400 font-bold text-lg flex-shrink-0 tabular-nums">{formatClaimsAmount(pred.expectedClaims)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Adjuster Deployment */}
      <Card className="bg-gray-900 border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <div className="w-6 h-6 border-2 border-white rounded-sm"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-2xl font-bold text-white leading-tight mb-1">Adjuster Deployment</h3>
              <p className="text-blue-200 text-sm font-medium leading-tight">Resource<br />allocation &<br />dispatch</p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400 font-medium">ACTIVE</span>
            </div>
          </div>
          
          <div className="text-center mb-8">
            <div className="text-6xl font-bold text-blue-400 mb-4 tracking-tight tabular-nums">{totalAdjusters}</div>
            <div className="text-gray-300 font-medium text-base mb-4">Adjusters needed</div>
            <div className="w-20 h-1 bg-blue-500 rounded-full mx-auto"></div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <span className="text-gray-300 font-medium text-base">High Priority Zones</span>
                <span className="text-white font-bold text-2xl tabular-nums">{criticalEvents + highEvents}</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-medium text-base">Deployment Status</span>
                  <span className="text-white font-bold text-xl tabular-nums">75%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500" style={{ width: '75%' }}></div>
                </div>
              </div>
            </div>
            
            {highEvents > 0 && (
              <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border border-orange-600/50 rounded-xl p-4 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-orange-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <span className="text-orange-200 font-semibold leading-relaxed flex-1">High demand detected</span>
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
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
