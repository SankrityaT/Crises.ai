"use client";

import dynamic from "next/dynamic";

interface MapViewProps {
  className?: string;
}

const MapViewInner = dynamic(() => import("./map-view-inner"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100" />,
});

export function MapView(props: MapViewProps) {
  return <MapViewInner {...props} />;
}
