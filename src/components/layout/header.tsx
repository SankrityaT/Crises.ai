"use client";

import { useState } from "react";
import Image from "next/image";
import { useTheme } from "@/contexts/theme-context";

type NavTab = 'dashboard' | 'analytics';

interface HeaderProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export function Header({ activeTab = 'dashboard', onTabChange }: HeaderProps) {
  const [currentTab, setCurrentTab] = useState<NavTab>(activeTab);
  const { theme, toggleTheme } = useTheme();

  const handleTabClick = (tab: NavTab) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  return (
    <header className="bg-[var(--panel-bg)] border-b border-[var(--panel-border)] sticky top-0 z-50 backdrop-blur-xl bg-opacity-90">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
            <Image src="/logo.svg" alt="Crises.ai Logo" width={24} height={24} className="brightness-0 invert" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Crises.ai</h1>
            <p className="text-xs text-[var(--text-muted)] font-medium">Emergency Intelligence Platform</p>
          </div>
        </div>

        {/* Navigation - Centered */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <nav className="hidden md:flex items-center gap-1 bg-[var(--hover-bg)] rounded-2xl p-1 border border-[var(--card-border)]">
            <button 
              onClick={() => handleTabClick('dashboard')}
              className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                currentTab === 'dashboard' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </span>
            </button>
            <button 
              onClick={() => handleTabClick('analytics')}
              className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                currentTab === 'analytics' 
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30' 
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analytics
              </span>
            </button>
          </nav>
        </div>

        {/* Right side - Theme toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--hover-bg)] border border-[var(--card-border)] hover:border-[var(--accent-primary)] transition-all duration-300 group"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
