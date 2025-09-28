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

type NavTab = 'dashboard' | 'analytics';

export default function MapPage() {
  const { 
    connectionStatus 
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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <Header activeTab={navTab} onTabChange={handleNavTabChange} />

      {/* Main Dashboard */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Collapsible Panel */}
        <div className={`${leftPanelOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-lg z-20 ${
          leftPanelOpen ? 'lg:w-80 md:w-72 sm:w-64' : 'w-0'
        }`}>
          {leftPanelOpen && (
            <>
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button
                  onClick={() => setActiveTab('layers')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'layers' 
                      ? 'bg-white text-slate-900 border-b-2 border-slate-900' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Layers
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'analytics' 
                      ? 'bg-white text-slate-900 border-b-2 border-slate-900' 
                      : 'text-slate-600 hover:text-slate-900'
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
          className={`absolute top-4 ${leftPanelOpen ? 'left-72' : 'left-4'} z-30 w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center`}
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        >
          <div className={`w-4 h-4 border-2 border-gray-600 rounded-sm transform transition-transform ${leftPanelOpen ? 'rotate-180' : ''}`}>
            <div className="w-1 h-1 bg-gray-600 rounded-full ml-auto mt-1"></div>
          </div>
        </button>

        {/* Map Container */}
        <div className="flex-1 relative bg-gray-100">
          <MapView />
          
          {/* Floating Controls */}
          <div className="absolute top-4 right-4 z-20">
            <button
              className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl flex items-center justify-center"
              onClick={toggleFullscreen}
            >
              <div className={`w-4 h-4 border-2 border-gray-600 rounded transition-all ${
                isFullscreen ? 'border-dashed' : 'border-solid'
              }`}>
                <div className={`w-1 h-1 bg-gray-600 rounded-full transition-all ${
                  isFullscreen ? 'ml-1 mt-1' : 'ml-auto mt-auto'
                }`}></div>
              </div>
            </button>
          </div>

          {/* Floating Status Panel */}
          {!isFullscreen && (
            <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200 rounded-lg z-20">
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium text-slate-700">
                        {connectionStatus === 'connected' ? 'Live' : 'Offline'}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      Updated: --:--:--
                    </div>
                    <div className="text-sm text-slate-500">
                      Events: <span className="font-semibold text-red-600">12</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      Calls: <span className="font-semibold text-orange-600">51</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded"
                  >
                    Feed
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sliding Panel */}
        <div className={`${rightPanelOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-l border-slate-200 flex flex-col overflow-hidden shadow-lg z-20`}>
          {rightPanelOpen && (
            <>
              <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
                <h3 className="font-semibold text-slate-900">Activity Feed</h3>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-700 rounded"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <LiveFeed />
              </div>
            </>
          )}
        </div>

        {/* Right Panel Toggle (when closed) */}
        {!rightPanelOpen && (
          <button
            className="absolute top-16 right-4 z-30 w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl flex items-center justify-center"
            onClick={() => setRightPanelOpen(true)}
          >
            <div className="w-4 h-4 border-2 border-gray-600 rounded-sm">
              <div className="flex flex-col gap-0.5 mt-0.5 ml-0.5">
                <div className="w-1 h-0.5 bg-gray-600 rounded-full"></div>
                <div className="w-1.5 h-0.5 bg-gray-600 rounded-full"></div>
                <div className="w-1 h-0.5 bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
