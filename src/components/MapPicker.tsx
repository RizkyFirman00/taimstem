"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Search, Loader2 } from "lucide-react";
import { searchLocation, getReverseGeocoding, type LocationData, DEFAULT_LOCATION } from "@/lib/location";
import { cn } from "@/lib/utils";

// Dynamic import for Leaflet map with no SSR
const MapInner = dynamic(() => import("./Map/MapInner"), {
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
      <Loader2 className="animate-spin" />
    </div>
  ),
  ssr: false,
});

interface MapPickerProps {
  location?: LocationData;
  onLocationChange: (location: LocationData) => void;
  className?: string;
}

export function MapPicker({
  location = DEFAULT_LOCATION,
  onLocationChange,
  className,
}: MapPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        const fetchLocations = async () => {
          setIsSearching(true);
          const locations = await searchLocation(query);
          setResults(locations);
          setIsSearching(false);
        };
        fetchLocations();
      } else {
        setResults([]);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectResult = (result: LocationData) => {
    onLocationChange(result);
    setResults([]);
    setQuery("");
  };

  const handleMapClick = async (lat: number, lng: number) => {
    // Optimistic update
    onLocationChange({
        ...location,
        lat,
        lng,
        address: "Loading address...",
    });

    const address = await getReverseGeocoding(lat, lng);
    
    onLocationChange({
      ...location,
      lat,
      lng,
      address,
    });
  };

  return (
    <div className={cn("flex flex-col gap-4 h-full", className)}>
      {/* Search Bar */}
      <div className="relative z-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city or place..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="animate-spin text-slate-400" size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {results.map((result, i) => (
              <button
                key={i}
                onClick={() => handleSelectResult(result)}
                className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
              >
                <div className="font-medium text-slate-200">{result.city || result.address.split(',')[0]}</div>
                <div className="text-xs text-slate-400 truncate">{result.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div className="flex-1 min-h-[300px] bg-slate-900 rounded-2xl overflow-hidden border border-white/5 relative">
        <MapInner
          center={[location.lat, location.lng]}
          zoom={13}
          onLocationSelect={handleMapClick}
        />
        
        {/* Current Location Badge */}
        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-white/10 z-[400] shadow-lg">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Selected Location</p>
          <p className="text-sm text-white font-medium truncate">
            {location.address}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        </div>
      </div>
    </div>
  );
}
