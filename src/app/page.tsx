"use client";

import { useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { PhotoCard } from "@/components/PhotoCard";
import { MapPicker } from "@/components/MapPicker";
import { Modal } from "@/components/Modal";
import { Loader2, Download, RefreshCw, Plus } from "lucide-react";
import { DEFAULT_LOCATION, type LocationData } from "@/lib/location";
import { cn } from "@/lib/utils";
import ExifReader from "exifreader";

type PhotoFile = {
  id: string;
  file: File;
  preview: string;
  location: LocationData;
  timestamp: Date;
  status: "pending" | "processing" | "done" | "error";
  processedUrl?: string;
};

type AttendancePair = {
  id: string;
  masuk?: PhotoFile;
  keluar?: PhotoFile;
};

export default function Home() {
  const [pairs, setPairs] = useState<AttendancePair[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  // State for global processing
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  // State for file selection processing
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
  });

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessingFiles(true);
    setProcessingProgress({ current: 0, total: files.length });

    const newPhotos: PhotoFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileToProcess = file;
      let previewUrl = "";

      if (file.name.toLowerCase().endsWith(".heic")) {
        try {
          // Dynamic import to avoid SSR issues
          const heic2any = (await import("heic2any")).default;
          const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.9,
          });

          const blobToUse = Array.isArray(convertedBlob)
            ? convertedBlob[0]
            : convertedBlob;

          // Create a new File object from the blob
          fileToProcess = new File(
            [blobToUse],
            file.name.replace(/\.heic$/i, ".jpg"),
            { type: "image/jpeg" },
          );

          previewUrl = URL.createObjectURL(blobToUse);
        } catch (e) {
          console.error("HEIC conversion failed", e);
          previewUrl = URL.createObjectURL(file);
        }
      } else {
        previewUrl = URL.createObjectURL(file);
      }

      let initialLocation = { ...DEFAULT_LOCATION };
      try {
        // Read full EXIF metadata from file
        const tags = await ExifReader.load(file);
        if (tags.GPSLatitude && tags.GPSLongitude) {
          let lat = Number(tags.GPSLatitude.description);
          let lng = Number(tags.GPSLongitude.description);

          if (tags.GPSLatitudeRef && tags.GPSLatitudeRef.value[0] === "S")
            lat = -lat;
          if (tags.GPSLongitudeRef && tags.GPSLongitudeRef.value[0] === "W")
            lng = -lng;

          if (!isNaN(lat) && !isNaN(lng)) {
            // Now reverse geocode to get an address string
            let address = "Unknown Location";
            try {
              const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
              if (res.ok) {
                const data = await res.json();
                if (data.results?.[0]) {
                  address = data.results[0].formatted_address;
                }
              }
            } catch (e) {
              console.error("Geocoding failed", e);
            }

            initialLocation = {
              lat,
              lng,
              address,
              city: "",
            };
          }
        }
      } catch (e) {
        console.error("Failed to extract EXIF data:", e);
      }

      newPhotos.push({
        id: Math.random().toString(36).substring(7),
        file: fileToProcess,
        preview: previewUrl,
        location: initialLocation,
        timestamp: new Date(file.lastModified || Date.now()),
        status: "pending" as const,
      });

      setProcessingProgress({ current: i + 1, total: files.length });
    }

    setPairs((prev) => {
      const updatedPairs = [...prev];
      let currentPhotos = [...newPhotos];

      for (let i = 0; i < currentPhotos.length; i += 2) {
        const pMasuk = currentPhotos[i];
        const pKeluar = currentPhotos[i + 1];

        if (pKeluar) {
          // Adjust time to exactly 8.5 hours after pMasuk
          const newTimestamp = new Date(
            pMasuk.timestamp.getTime() + 8.5 * 60 * 60 * 1000,
          );
          pKeluar.timestamp = newTimestamp;
        }

        updatedPairs.push({
          id: Math.random().toString(36).substring(7),
          masuk: pMasuk,
          keluar: pKeluar,
        });
      }

      return updatedPairs;
    });

    setIsProcessingFiles(false);
  };

  const handleAddKeluar = async (pairId: string, files: File[]) => {
    if (!files.length) return;

    setIsProcessingFiles(true);
    setProcessingProgress({ current: 0, total: 1 });

    const file = files[0];

    let fileToProcess = file;
    let previewUrl = "";

    if (file.name.toLowerCase().endsWith(".heic")) {
      try {
        const heic2any = (await import("heic2any")).default;
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });
        const blobToUse = Array.isArray(convertedBlob)
          ? convertedBlob[0]
          : convertedBlob;

        fileToProcess = new File(
          [blobToUse],
          file.name.replace(/\.heic$/i, ".jpg"),
          { type: "image/jpeg" },
        );
        previewUrl = URL.createObjectURL(blobToUse);
      } catch (e) {
        console.error("HEIC conversion failed", e);
        previewUrl = URL.createObjectURL(file);
      }
    } else {
      previewUrl = URL.createObjectURL(file);
    }

    let initialLocation = { ...DEFAULT_LOCATION };
    try {
      const tags = await ExifReader.load(file);
      if (tags.GPSLatitude && tags.GPSLongitude) {
        let lat = Number(tags.GPSLatitude.description);
        let lng = Number(tags.GPSLongitude.description);

        if (tags.GPSLatitudeRef && tags.GPSLatitudeRef.value[0] === "S")
          lat = -lat;
        if (tags.GPSLongitudeRef && tags.GPSLongitudeRef.value[0] === "W")
          lng = -lng;

        if (!isNaN(lat) && !isNaN(lng)) {
          let address = "Unknown Location";
          try {
            const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data.results?.[0]) {
                address = data.results[0].formatted_address;
              }
            }
          } catch (e) {}

          initialLocation = { lat, lng, address, city: "" };
        }
      }
    } catch (e) {
      console.error("Failed to extract EXIF data for keluar:", e);
    }

    const newKeluarPhoto: PhotoFile = {
      id: Math.random().toString(36).substring(7),
      file: fileToProcess,
      preview: previewUrl,
      location: initialLocation,
      timestamp: new Date(),
      status: "pending",
    };

    setProcessingProgress({ current: 1, total: 1 });

    setPairs((prev) =>
      prev.map((pair) => {
        if (pair.id === pairId) {
          const updatedKeluar = { ...newKeluarPhoto };
          // If masuk exists, sync timestamp to exactly +8.5 hours
          if (pair.masuk) {
            updatedKeluar.timestamp = new Date(
              pair.masuk.timestamp.getTime() + 8.5 * 60 * 60 * 1000,
            );
          }
          return { ...pair, keluar: updatedKeluar };
        }
        return pair;
      }),
    );

    setIsProcessingFiles(false);
  };

  const removePhoto = (pairId: string, type: "masuk" | "keluar") => {
    setPairs((prev) =>
      prev
        .map((pair) => {
          if (pair.id === pairId) {
            return { ...pair, [type]: undefined };
          }
          return pair;
        })
        .filter((pair) => pair.masuk || pair.keluar),
    );
  };

  const removePair = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
  };

  const openLocationPicker = (id: string) => {
    setActivePhotoId(id);
    setModalOpen(true);
  };

  const handleLocationUpdate = (location: LocationData) => {
    if (activePhotoId) {
      setPairs((prev) =>
        prev.map((pair) => {
          const updated = { ...pair };
          if (pair.masuk?.id === activePhotoId) {
            updated.masuk = { ...pair.masuk, location };
          }
          if (pair.keluar?.id === activePhotoId) {
            updated.keluar = { ...pair.keluar, location };
          }
          return updated;
        }),
      );
    }
  };

  const updatePhotoTime = (
    pairId: string,
    type: "masuk" | "keluar",
    date: Date,
  ) => {
    setPairs((prev) =>
      prev.map((pair) => {
        if (pair.id === pairId) {
          const updated = { ...pair };
          if (type === "masuk" && updated.masuk) {
            updated.masuk = { ...updated.masuk, timestamp: date };
            // Auto update keluar if it exists
            if (updated.keluar) {
              updated.keluar = {
                ...updated.keluar,
                timestamp: new Date(date.getTime() + 8.5 * 60 * 60 * 1000),
              };
            }
          } else if (type === "keluar" && updated.keluar) {
            updated.keluar = { ...updated.keluar, timestamp: date };
          }
          return updated;
        }
        return pair;
      }),
    );
  };

  const processPhoto = async (photo: PhotoFile) => {
    const formData = new FormData();
    formData.append("file", photo.file);
    formData.append("lat", photo.location.lat.toString());
    formData.append("lng", photo.location.lng.toString());
    formData.append("address", photo.location.address);
    // Construct local ISO string manually to preserve local time values
    const d = photo.timestamp;
    const pad = (n: number) => n.toString().padStart(2, "0");
    const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    formData.append("date", localIso);

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

    const newPairs = [...pairs];

    for (let i = 0; i < newPairs.length; i++) {
      const pair = newPairs[i];
      if (pair.masuk && pair.masuk.status !== "done") {
        pair.masuk.status = "processing";
        setPairs([...newPairs]);
        const url = await processPhoto(pair.masuk);
        pair.masuk.status = url ? "done" : "error";
        pair.masuk.processedUrl = url || undefined;
        setPairs([...newPairs]);
      }

      if (pair.keluar && pair.keluar.status !== "done") {
        pair.keluar.status = "processing";
        setPairs([...newPairs]);
        const url = await processPhoto(pair.keluar);
        pair.keluar.status = url ? "done" : "error";
        pair.keluar.processedUrl = url || undefined;
        setPairs([...newPairs]);
      }
    }

    setIsProcessingAll(false);
  };

  const handleDownload = (photo: PhotoFile) => {
    if (photo.processedUrl) {
      const a = document.createElement("a");
      a.href = photo.processedUrl;
      a.download = `stamped_${photo.file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const getActivePhoto = () => {
    for (const p of pairs) {
      if (p.masuk?.id === activePhotoId) return p.masuk;
      if (p.keluar?.id === activePhotoId) return p.keluar;
    }
    return null;
  };
  const activePhoto = getActivePhoto();

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

        {pairs.length > 0 && (
          <div className="flex gap-4">
            <button
              onClick={handleProcessAll}
              disabled={isProcessingAll}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95",
                isProcessingAll
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:brightness-110",
              )}
            >
              {isProcessingAll ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              {isProcessingAll ? "Processing..." : "Process All Files"}
            </button>
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto">
        {pairs.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-20 fade-in slide-in-from-bottom-5 duration-500">
            <UploadZone onFilesSelected={handleFilesSelected} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Add More Bar */}
            <div className="flex justify-end">
              <div className="relative overflow-hidden rounded-xl bg-slate-800/50 border border-white/10 hover:bg-slate-800 transition-colors cursor-pointer group">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.length)
                      handleFilesSelected(Array.from(e.target.files));
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="flex items-center gap-2 px-4 py-2 opacity-70 group-hover:opacity-100">
                  <Plus size={18} className="text-cyan-400" />
                  <span className="text-sm font-medium text-slate-300">
                    Add more photos
                  </span>
                </div>
              </div>
            </div>

            {/* Pairs Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {pairs.map((pair) => (
                <div
                  key={pair.id}
                  className="bg-slate-800/30 border border-white/5 rounded-3xl p-6 relative group/pair"
                >
                  {/* Remove Pair Button */}
                  <button
                    onClick={() => removePair(pair.id)}
                    className="absolute -top-3 -right-3 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-400/20 border border-white/10 opacity-0 group-hover/pair:opacity-100 transition-all z-20"
                    title="Remove Pair"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <span className="sr-only">Remove Pair</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Masuk */}
                    {pair.masuk ? (
                      <div className="relative group/card h-full">
                        <PhotoCard
                          title="Absen Masuk"
                          file={pair.masuk.file}
                          previewUrl={
                            pair.masuk.processedUrl || pair.masuk.preview
                          }
                          location={pair.masuk.location}
                          timestamp={pair.masuk.timestamp}
                          onRemove={() => removePhoto(pair.id, "masuk")}
                          onLocationClick={() =>
                            openLocationPicker(pair.masuk!.id)
                          }
                          onDateTimeChange={(date) =>
                            updatePhotoTime(pair.id, "masuk", date)
                          }
                          className={cn(
                            "h-full transition-all duration-300",
                            pair.masuk.status === "processing" &&
                              "opacity-70 grayscale",
                            activePhotoId === pair.masuk.id &&
                              "ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#0f172a]",
                          )}
                        />

                        {/* Processing Status Overlay */}
                        {pair.masuk.status === "processing" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl z-10">
                            <div className="bg-slate-900 rounded-full p-3 shadow-xl border border-white/10">
                              <Loader2
                                className="animate-spin text-cyan-400"
                                size={32}
                              />
                            </div>
                          </div>
                        )}

                        {/* Done Action Overlay */}
                        {pair.masuk.status === "done" && (
                          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover/card:translate-y-0 transition-transform duration-300 z-10">
                            <button
                              onClick={() => handleDownload(pair.masuk!)}
                              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/50"
                            >
                              <Download size={20} /> Download
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-900/30 text-slate-500 h-full">
                        <p className="font-medium text-sm">No Absen Masuk</p>
                      </div>
                    )}

                    {/* Keluar */}
                    {pair.keluar ? (
                      <div className="relative group/card h-full">
                        <PhotoCard
                          title="Absen Keluar"
                          file={pair.keluar.file}
                          previewUrl={
                            pair.keluar.processedUrl || pair.keluar.preview
                          }
                          location={pair.keluar.location}
                          timestamp={pair.keluar.timestamp}
                          onRemove={() => removePhoto(pair.id, "keluar")}
                          onLocationClick={() =>
                            openLocationPicker(pair.keluar!.id)
                          }
                          onDateTimeChange={(date) =>
                            updatePhotoTime(pair.id, "keluar", date)
                          }
                          className={cn(
                            "h-full transition-all duration-300",
                            pair.keluar.status === "processing" &&
                              "opacity-70 grayscale",
                            activePhotoId === pair.keluar.id &&
                              "ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#0f172a]",
                          )}
                        />

                        {/* Processing Status Overlay */}
                        {pair.keluar.status === "processing" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl z-10">
                            <div className="bg-slate-900 rounded-full p-3 shadow-xl border border-white/10">
                              <Loader2
                                className="animate-spin text-cyan-400"
                                size={32}
                              />
                            </div>
                          </div>
                        )}

                        {/* Done Action Overlay */}
                        {pair.keluar.status === "done" && (
                          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover/card:translate-y-0 transition-transform duration-300 z-10">
                            <button
                              onClick={() => handleDownload(pair.keluar!)}
                              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-900/50"
                            >
                              <Download size={20} /> Download
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-900/30 text-slate-500 h-full relative cursor-pointer group/add hover:bg-slate-800/50 hover:border-cyan-500/30 transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.length)
                              handleAddKeluar(
                                pair.id,
                                Array.from(e.target.files),
                              );
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="p-3 rounded-full bg-slate-800 mb-3 group-hover/add:bg-cyan-500/20 group-hover/add:text-cyan-400 transition-colors">
                          <Plus size={24} />
                        </div>
                        <p className="font-medium text-sm group-hover/add:text-slate-300">
                          Add Absen Keluar
                        </p>
                      </div>
                    )}
                  </div>
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

      {/* Processing Upload Modal */}
      {isProcessingFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-800 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full mx-4 space-y-6 text-center shadow-cyan-900/10">
            <div className="flex justify-center">
              <div className="bg-slate-900/50 p-4 rounded-full border border-white/5 relative">
                <Loader2 className="animate-spin text-cyan-400" size={48} />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-indigo-300">
                Processing Photos
              </h3>
              <p className="text-sm text-slate-400">
                Extracting exact time & location... {processingProgress.current}{" "}
                / {processingProgress.total}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-slate-900/80 rounded-full overflow-hidden w-full relative border border-white/5">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-300 ease-out"
                style={{
                  width: `${Math.max(5, (processingProgress.current / processingProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
