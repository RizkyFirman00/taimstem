"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud, Image as ImageIcon } from "lucide-react";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export function UploadZone({ onFilesSelected, className }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );
      
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files).filter((file) =>
          file.type.startsWith("image/")
        );
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  return (
    <div
      className={cn(
        "relative group cursor-pointer transition-all duration-300",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept="image/*,.heic"
        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
        onChange={handleFileInput}
      />
      
      <div
        className={cn(
          "w-full h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all duration-300",
          isDragging
            ? "border-cyan-400 bg-cyan-400/10 scale-[1.02]"
            : "border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-800/50"
        )}
      >
        <div className={cn(
          "p-4 rounded-full bg-slate-800 transition-all duration-500", 
          isDragging ? "bg-cyan-500/20 text-cyan-400 scale-110" : "text-slate-400 group-hover:text-cyan-400 group-hover:scale-110"
        )}>
          {isDragging ? <ImageIcon size={48} /> : <UploadCloud size={48} />}
        </div>
        
        <div className="text-center space-y-1">
          <h3 className="text-lg font-medium text-slate-200">
            {isDragging ? "Drop images here" : "Click or drag images to upload"}
          </h3>
          <p className="text-sm text-slate-400">
            Supports JPG, PNG, WEBP, HEIC
          </p>
        </div>
      </div>
    </div>
  );
}
