"use client";

import { useMemo } from "react";
import { X, MapPin, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocationData } from "@/lib/location";

interface PhotoCardProps {
  file: File;
  previewUrl: string;
  location?: LocationData;
  timestamp?: Date;
  onRemove: () => void;
  onLocationClick: () => void;
  onDateTimeChange: (date: Date) => void;
  className?: string;
}

export function PhotoCard({
  file,
  previewUrl,
  location,
  timestamp,
  onRemove,
  onLocationClick,
  onDateTimeChange,
  className,
}: PhotoCardProps) {
  const formattedDate = useMemo(() => {
    return (timestamp || new Date()).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [timestamp]);

  const formattedTime = useMemo(() => {
    return (timestamp || new Date()).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [timestamp]);

  return (
    <div className={cn("glass overflow-hidden rounded-2xl relative group animate-in fade-in zoom-in-95 duration-300", className)}>
      {/* Image Preview */}
      <div className="relative aspect-[4/3] w-full bg-slate-900 border-b border-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={file.name}
          className="w-full h-full object-cover"
        />
        
        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white/70 hover:bg-red-500/80 hover:text-white backdrop-blur-md transition-colors"
        >
          <X size={16} />
        </button>

        {/* Status Overlay (Example for processed) */}
        {/* <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
           <button className="btn-primary">Edit</button>
        </div> */}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Location Selector */}
        <button
          onClick={onLocationClick}
          className="w-full flex items-start gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left group/loc"
        >
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 group-hover/loc:bg-indigo-500 group-hover/loc:text-white transition-colors">
            <MapPin size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium mb-0.5">Location</p>
            <p className="text-sm text-slate-200 truncate font-semibold">
              {location?.city || location?.address || "Set Location"}
            </p>
          </div>
        </button>

        {/* Date/Time Edit */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors relative">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={timestamp ? timestamp.toISOString().split('T')[0] : ''}
              className="bg-transparent text-xs text-slate-300 w-full focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full"
              onChange={(e) => {
                const val = e.target.valueAsDate;
                if (val && timestamp) {
                   const newDate = new Date(timestamp);
                   newDate.setFullYear(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate());
                   onDateTimeChange(newDate);
                }
              }}
            />
          </div>
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors relative">
            <Clock size={14} className="text-slate-400 shrink-0" />
             <input
              type="time"
              value={timestamp ? timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : ''}
              className="bg-transparent text-xs text-slate-300 w-full focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full"
              onChange={(e) => {
                 const [h, m] = e.target.value.split(':').map(Number);
                 if (!isNaN(h) && timestamp) {
                    const newDate = new Date(timestamp);
                    newDate.setHours(h);
                    newDate.setMinutes(m);
                    onDateTimeChange(newDate);
                 }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
