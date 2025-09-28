"use client";

import { useState } from "react";
import Image from "next/image";

type NavTab = 'dashboard' | 'analytics';

interface HeaderProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export function Header({ activeTab = 'dashboard', onTabChange }: HeaderProps) {
  const [currentTab, setCurrentTab] = useState<NavTab>(activeTab);

  const handleTabClick = (tab: NavTab) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo and Title */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center shadow-sm">
            <Image src="/logo.svg" alt="Crises.ai Logo" width={40} height={40} className="rounded-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Crises.ai</h1>
            <p className="text-sm text-gray-600">Real-Time Emergency Intelligence</p>
          </div>
        </div>

        {/* Navigation - Centered */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <nav className="hidden md:flex items-center justify-center gap-2 bg-gray-100 rounded-full p-1">
            <button 
              onClick={() => handleTabClick('dashboard')}
              className={`px-6 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                currentTab === 'dashboard' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => handleTabClick('analytics')}
              className={`px-6 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                currentTab === 'analytics' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>

        {/* Right side - Empty now */}
        <div className="flex items-center gap-3">
          {/* Placeholder for future elements */}
        </div>
      </div>
    </header>
  );
}
