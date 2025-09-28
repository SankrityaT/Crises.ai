"use client";

import { AlertTriangle, Clock, Shield, Zap } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left side - Status indicators */}
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span>System Status: Operational</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span>Data Sources: 12 Active</span>
            </div>
          </div>

          {/* Right side - Company info */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>© 2024 State Farm Insurance</span>
            <span className="text-gray-400">|</span>
            <span>Emergency Response Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
