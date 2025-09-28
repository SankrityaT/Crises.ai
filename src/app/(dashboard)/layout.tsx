import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full max-w-xs border-b border-white/10 bg-slate-900/70 p-6 lg:h-screen lg:border-b-0 lg:border-r">
          <h1 className="text-2xl font-semibold tracking-tight text-red-400">
            CrisisLens
          </h1>
          <p className="mt-2 text-sm text-slate-300/80">
            Real-time emergency intelligence platform for State Farm.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-300/90">
            <li>• Live Map</li>
            <li>• Predictive Claims</li>
            <li>• Adjuster Deployment</li>
          </ul>
        </aside>
        <section className="flex-1 overflow-hidden bg-slate-950/90">
          {children}
        </section>
      </main>
    </div>
  );
}
