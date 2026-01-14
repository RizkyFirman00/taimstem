"use client";

import { useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { PhotoCard } from "@/components/PhotoCard";
import { MapPicker } from "@/components/MapPicker";
import { Modal } from "@/components/Modal";
import { Loader2, Download, RefreshCw, Plus } from "lucide-react";
import { DEFAULT_LOCATION, type LocationData } from "@/lib/location";
import { cn } from "@/lib/utils";

type PhotoFile = {
  id: string;
  file: File;
  preview: string;
  location: LocationData;
  timestamp: Date;
  status: "pending" | "processing" | "done" | "error";
  processedUrl?: string; // Blob URL
};

export default function Home() {
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  
  // State for global processing
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    const newPhotos = await Promise.all(files.map(async (file) => {
      let fileToProcess = file;
      let previewUrl = "";
      
      if (file.name.toLowerCase().endsWith(".heic")) {
        try {
          // Dynamic import to avoid SSR issues
          const heic2any = (await import("heic2any")).default;
          const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.9
          });
          
          const blobToUse = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          
          // Create a new File object from the blob
          fileToProcess = new File(
            [blobToUse], 
            file.name.replace(/\.heic$/i, ".jpg"), 
            { type: "image/jpeg" }
          );
          
          previewUrl = URL.createObjectURL(blobToUse);
        } catch (e) {
          console.error("HEIC conversion failed", e);
          previewUrl = URL.createObjectURL(file);
        }
      } else {
        previewUrl = URL.createObjectURL(file);
      }

      return {
        id: Math.random().toString(36).substring(7),
        file: fileToProcess,
        preview: previewUrl,
        location: DEFAULT_LOCATION,
        timestamp: new Date(file.lastModified || Date.now()),
        status: "pending" as const,
      };
    }));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setPhotos((prev) => [...prev, ...newPhotos] as any);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const openLocationPicker = (id: string) => {
    setActivePhotoId(id);
    setModalOpen(true);
  };

  const handleLocationUpdate = (location: LocationData) => {
    if (activePhotoId) {
      setPhotos((prev) => prev.map(p => 
        p.id === activePhotoId ? { ...p, location } : p
      ));
      // Optional: Close modal automatically or keep open? Keep open for refinement.
    }
  };

  const processPhoto = async (photo: PhotoFile) => {
    const formData = new FormData();
    formData.append("file", photo.file);
    formData.append("lat", photo.location.lat.toString());
    formData.append("lng", photo.location.lng.toString());
    formData.append("address", photo.location.address);
    formData.append("date", photo.timestamp.toISOString());

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Processing failed");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return url;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    
    // Process sequentially or parallel? Parallel limit is better for server.
    // Let's do simple sequential or loop for now as client side limitation isn't issue, 
    // but server side `sharp` might spike memory. Sequential is safer for home server.
    
    const newPhotos = [...photos];
    
    for (let i = 0; i < newPhotos.length; i++) {
        if (newPhotos[i].status === 'done') continue;
        
        newPhotos[i].status = 'processing';
        setPhotos([...newPhotos]); // Trigger update
        
        const url = await processPhoto(newPhotos[i]);
        
        if (url) {
            newPhotos[i].status = 'done';
            newPhotos[i].processedUrl = url;
        } else {
            newPhotos[i].status = 'error';
        }
        setPhotos([...newPhotos]);
    }
    
    setIsProcessingAll(false);
  };

  const handleDownload = (photo: PhotoFile) => {
    if (photo.processedUrl) {
        const a = document.createElement('a');
        a.href = photo.processedUrl;
        a.download = `stamped_${photo.file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
  };
  
  const activePhoto = photos.find(p => p.id === activePhotoId);

  return (
    <main className="min-h-screen p-8 pb-32">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-500 tracking-tight">
            TaimStem
          </h1>
          <p className="text-slate-400 font-medium">Geo-Timestamp</p>
        </div>
        
        {photos.length > 0 && (
          <div className="flex gap-4">
             <button 
               onClick={handleProcessAll}
               disabled={isProcessingAll}
               className={cn(
                 "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95",
                 isProcessingAll 
                   ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                   : "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:brightness-110"
               )}
             >
               {isProcessingAll ? <Loader2 className="animate-spin" /> : <RefreshCw />}
               {isProcessingAll ? "Processing..." : "Process All Files"}
             </button>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto">
        {photos.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-20 fade-in slide-in-from-bottom-5 duration-500">
            <UploadZone onFilesSelected={handleFilesSelected} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Add More Bar */}
            <div className="flex justify-end">
                <div className="relative overflow-hidden rounded-xl bg-slate-800/50 border border-white/10 hover:bg-slate-800 transition-colors cursor-pointer group">
                    <input type="file" multiple accept="image/*" onChange={(e) => {
                        if(e.target.files?.length) handleFilesSelected(Array.from(e.target.files));
                    }} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="flex items-center gap-2 px-4 py-2 opacity-70 group-hover:opacity-100">
                        <Plus size={18} className="text-cyan-400"/>
                        <span className="text-sm font-medium text-slate-300">Add more photos</span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group/card">
                   <PhotoCard
                      file={photo.file}
                      previewUrl={photo.processedUrl || photo.preview}
                      location={photo.location}
                      timestamp={photo.timestamp}
                      onRemove={() => removePhoto(photo.id)}
                      onLocationClick={() => openLocationPicker(photo.id)}
                      onDateTimeChange={(date) => {
                          setPhotos(prev => prev.map(p => 
                              p.id === photo.id ? { ...p, timestamp: date } : p
                          ));
                      }}
                      className={cn(
                          "h-full transition-all duration-300", 
                          photo.status === 'processing' && "opacity-70 grayscale",
                          activePhotoId === photo.id && "ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#0f172a]"
                      )}
                    />
                    
                    {/* Processing Status Overlay */}
                    {photo.status === 'processing' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl z-10">
                            <div className="bg-slate-900 rounded-full p-3 shadow-xl border border-white/10">
                                <Loader2 className="animate-spin text-cyan-400" size={32} />
                            </div>
                        </div>
                    )}
                    
                    {/* Done Action Overlay */}
                    {photo.status === 'done' && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover/card:translate-y-0 transition-transform duration-300 z-10">
                            <button 
                                onClick={() => handleDownload(photo)}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/50"
                            >
                                <Download size={20} /> Download
                            </button>
                        </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Picker Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Select Location"
      >
        <div className="h-[60vh] md:h-[70vh]">
          {activePhoto && (
            <MapPicker
              location={activePhoto.location}
              onLocationChange={handleLocationUpdate}
            />
          )}
        </div>
      </Modal>
    </main>
  );
}
