export type LocationData = {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  country?: string;
};

export const DEFAULT_LOCATION: LocationData = {
  lat: -6.175256,
  lng: 106.821367,
  address: "Monas, Jakarta, Indonesia",
  city: "Jakarta",
  country: "Indonesia",
};

export async function searchLocation(query: string): Promise<LocationData[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=10&addressdetails=1&countrycodes=id&dedupe=1`,
      {
        headers: {
          "User-Agent": "TaimStem-App/1.0",
        },
      }
    );
    const data = await response.json();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
      city: item.address.city || item.address.town || item.address.village,
      country: item.address.country,
    }));
  } catch (error) {
    console.error("Error searching location:", error);
    return [];
  }
}
export async function getReverseGeocoding(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "TaimStem-App/1.0",
        },
      }
    );
    const data = await response.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
