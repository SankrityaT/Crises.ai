"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const LeafletMap = dynamic(() => import("./leaflet/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

export function MapView() {
  return (
    <div className="relative h-full w-full">
      <Suspense>
        <LeafletMap />
      </Suspense>
    </div>
  );
}

export default MapView;
