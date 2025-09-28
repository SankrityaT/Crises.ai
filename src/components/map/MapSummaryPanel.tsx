export function MapSummaryPanel() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-slate-100">Operational Summary</h2>
      <p className="mt-2 text-sm text-slate-300/90">
        Live metrics, predictive claims, and adjuster recommendations will appear here
        once the data pipelines are connected.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-400">
        <li>• Hook into `/api/map/bootstrap` for initial load.</li>
        <li>• Subscribe to real-time updates via WebSocket.</li>
        <li>• Display predictive insights from AI service.</li>
      </ul>
    </div>
  );
}

export default MapSummaryPanel;
