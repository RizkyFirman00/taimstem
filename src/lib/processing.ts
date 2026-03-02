export type TimestampConfig = {
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  date: string; // ISO string
};

export type ProcessedImage = {
  originalName: string;
  url: string; // Blob URL or Data URL
  downloadUrl?: string; // URL to download processed image
};
