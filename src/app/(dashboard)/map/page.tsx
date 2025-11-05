"use client";

import { useState } from "react";
import { MapView } from "@/components/map/map-view";
import { Header } from "@/components/layout/header";
import { FilterPanel } from "@/components/ui/filter-panel";
import { StatusCards } from "@/components/ui/status-cards";
import { LiveFeed } from "@/components/ui/live-feed";
import { useSocketEvents } from "@/hooks/use-socket-events";
import { useMapBootstrap } from "@/hooks/use-map-bootstrap";
import { useAIIntegration } from "@/hooks/use-ai-integration";
import { useMapStore } from "@/store/map-store";
import { getTimeAgo } from "@/lib/utils";

type NavTab = 'dashboard' | 'analytics';

export default function MapPage() {
  const { 
    connectionStatus,
    events,
    rapidCalls,
    lastUpdated
  } = useMapStore();

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'layers' | 'analytics'>('layers');
  const [navTab, setNavTab] = useState<NavTab>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize WebSocket connection, bootstrap data, and AI integration
  useSocketEvents();
  useMapBootstrap();
  useAIIntegration();

  const handleNavTabChange = (tab: NavTab) => {
    setNavTab(tab);
    
    if (tab === 'dashboard') {
      setLeftPanelOpen(true);
      setActiveTab('layers');
      setRightPanelOpen(false);
    } else if (tab === 'analytics') {
      setLeftPanelOpen(true);
      setActiveTab('analytics');
      setRightPanelOpen(true);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    } else {
      setLeftPanelOpen(true);
      setRightPanelOpen(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      {/* Header */}
      <Header activeTab={navTab} onTabChange={handleNavTabChange} />

      {/* Main Dashboard */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Collapsible Panel */}
        <div className={`${leftPanelOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-[var(--panel-bg)] border-r border-[var(--panel-border)] flex flex-col overflow-hidden shadow-[var(--shadow-lg)] z-20 ${
          leftPanelOpen ? 'lg:w-80 md:w-72 sm:w-64' : 'w-0'
        }`}>
          {leftPanelOpen && (
            <>
              {/* Tab Navigation */}
              <div className="flex border-b border-[var(--panel-border)] bg-[var(--hover-bg)]">
                <button
                  onClick={() => setActiveTab('layers')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === 'layers' 
                      ? 'bg-[var(--panel-bg)] text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-bg)]/50'
                  }`}
                >
                  Layers
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                    activeTab === 'analytics' 
                      ? 'bg-[var(--panel-bg)] text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-bg)]/50'
                  }`}
                >
                  Analytics
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                {activeTab === 'layers' && <FilterPanel />}
                {activeTab === 'analytics' && <StatusCards />}
              </div>
            </>
          )}
        </div>

        {/* Left Panel Toggle */}
        <button
          className={`absolute top-4 ${leftPanelOpen ? 'left-72' : 'left-4'} z-30 w-10 h-10 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] hover:border-[var(--accent-primary)] transition-all duration-300 flex items-center justify-center group`}
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        >
          <svg className={`w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-all ${leftPanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Map Container */}
        <div className="flex-1 relative bg-[var(--background)]">
          <MapView />
          
          {/* Floating Controls */}
          <div className="absolute top-4 right-4 z-20">
            <button
              className="w-10 h-10 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] hover:border-[var(--accent-primary)] flex items-center justify-center group transition-all"
              onClick={toggleFullscreen}
            >
              <svg className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          </div>

          {/* Floating Status Panel */}
          {!isFullscreen && (
            <div className="absolute bottom-4 left-4 right-4 bg-[var(--card-bg)]/95 backdrop-blur-sm shadow-[var(--shadow-lg)] border border-[var(--card-border)] rounded-xl z-20">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                        connectionStatus === 'connected' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500 shadow-lg shadow-red-500/50'
                      }`} />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {connectionStatus === 'connected' ? 'Live' : 'Offline'}
                      </span>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] font-medium">
                      Updated: {lastUpdated ? getTimeAgo(lastUpdated) : '--:--:--'}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      Events: <span className="font-bold text-red-500">{events.length}</span>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      Calls: <span className="font-bold text-orange-500">{rapidCalls.reduce((sum, call) => sum + (call.callCount || call.volume || 0), 0)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                    className="text-sm font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] px-3 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-all"
                  >
                    Activity Feed
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sliding Panel */}
        <div className={`${rightPanelOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-[var(--panel-bg)] border-l border-[var(--panel-border)] flex flex-col overflow-hidden shadow-[var(--shadow-lg)] z-20`}>
          {rightPanelOpen && (
            <>
              <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--hover-bg)]">
                <h3 className="font-semibold text-[var(--text-primary)]">Activity Feed</h3>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-bg)] rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <LiveFeed />
              </div>
            </>
          )}
        </div>

        {/* Right Panel Toggle (when closed) */}
        {!rightPanelOpen && (
          <button
            className="absolute top-16 right-4 z-30 w-10 h-10 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-xl)] hover:border-[var(--accent-primary)] flex items-center justify-center group transition-all"
            onClick={() => setRightPanelOpen(true)}
          >
            <svg className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
