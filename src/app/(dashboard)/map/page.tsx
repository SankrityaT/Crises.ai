import MapView from "@/components/map/MapView";
import { MapSummaryPanel } from "@/components/map/MapSummaryPanel";

export default function MapPage() {
  return (
    <div className="flex h-screen w-full flex-col gap-4 p-4">
      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-xl">
          <MapView />
        </div>
        <div className="flex flex-col gap-4">
          <MapSummaryPanel />
        </div>
      </div>
    </div>
  );
}
