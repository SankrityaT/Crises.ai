"use client";

import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMap } from "react-leaflet";

export function MapControls() {
  const map = useMap();

  const handleZoomIn = () => {
    map.zoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
  };

  const handleReset = () => {
    map.setView([39.8283, -98.5795], 4);
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      <Button
        variant="outline"
        size="icon"
        className="w-10 h-10 bg-white shadow-md hover:shadow-lg btn-hover"
        onClick={handleZoomIn}
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        className="w-10 h-10 bg-white shadow-md hover:shadow-lg btn-hover"
        onClick={handleZoomOut}
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        className="w-10 h-10 bg-white shadow-md hover:shadow-lg btn-hover"
        onClick={handleReset}
        title="Reset View"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        className="w-10 h-10 bg-white shadow-md hover:shadow-lg btn-hover"
        onClick={handleFullscreen}
        title="Toggle Fullscreen"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
