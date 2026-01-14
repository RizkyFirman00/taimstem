"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet generic marker icon missing by using CDN
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

function LocationMarker({ position, onLocationSelect }: { position: [number, number], onLocationSelect: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });
  
  // Update map center when position changes externally
  useEffect(() => {
    map.flyTo(position, map.getZoom());
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position} icon={defaultIcon}></Marker>
  );
}

interface MapInnerProps {
  center: [number, number];
  zoom: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

export default function MapInner({ center, zoom, onLocationSelect }: MapInnerProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%", borderRadius: "0.5rem" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker position={center} onLocationSelect={onLocationSelect} />
    </MapContainer>
  );
}
