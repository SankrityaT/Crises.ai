"use client";

import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer } from "react-leaflet";

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

export default function LeafletMap() {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={5}
      className="h-full w-full"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}
