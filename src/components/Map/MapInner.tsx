"use client";

import { useEffect, useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";

interface MapInnerProps {
  center: [number, number];
  zoom: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

const containerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "0.5rem",
};

export default function MapInner({
  center,
  zoom,
  onLocationSelect,
}: MapInnerProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    // prevent multiple maps scripts from failing if loaded elsewhere later
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      onLocationSelect(e.latLng.lat(), e.latLng.lng());
    }
  };

  useEffect(() => {
    if (map) {
      map.panTo({ lat: center[0], lng: center[1] });
      // Removed map.setZoom(zoom) to prevent losing user-adjusted zoom level when placing a pin
    }
  }, [center, map]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={{ lat: center[0], lng: center[1] }}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={handleMapClick}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {/* 
        Using MarkerF instead of Marker stringently due to React 18 strict mode issues 
        with standard Marker component in @react-google-maps/api
      */}
      <MarkerF position={{ lat: center[0], lng: center[1] }} />
    </GoogleMap>
  );
}
