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
  address: "Monumen Nasional, Gambir, Jakarta Pusat, DKI Jakarta, Indonesia",
  city: "Jakarta Pusat",
  country: "Indonesia",
};

const getApiKey = () => {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.warn("GOOGLE_MAPS_API_KEY is not defined.");
  }
  return key || "";
};

// Helper to extract city and country from Google Geocoding address_components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseAddressComponents = (components: any[]) => {
  let city = "";
  let country = "";

  for (const component of components) {
    const types = component.types;
    if (
      types.includes("locality") ||
      types.includes("administrative_area_level_2")
    ) {
      city = component.long_name;
    }
    if (types.includes("country")) {
      country = component.long_name;
    }
  }

  return { city, country };
};

export async function searchLocation(query: string): Promise<LocationData[]> {
  try {
    // Call our own Next.js backend API proxy instead of Google directly to avoid CORS
    const response = await fetch(`/api/places?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      console.error("Internal API error:", response.statusText);
      return [];
    }

    const data = await response.json();

    if (data.error) {
      console.error(
        "Places API Proxy error:",
        JSON.stringify(data.error, null, 2),
      );
      return [];
    }

    if (!data.places || data.places.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.places.slice(0, 5).map((place: any) => {
      return {
        lat: place.location.latitude,
        lng: place.location.longitude,
        address:
          `${place.displayName?.text || ""}, ${place.formattedAddress || ""}`.replace(
            /^,\s/,
            "",
          ),
        city: "", // Not explicitly provided separately by default in v1
        country: "Indonesia",
      };
    });
  } catch (error) {
    console.error("Error searching location:", error);
    return [];
  }
}

export async function getReverseGeocoding(
  lat: number,
  lng: number,
): Promise<string> {
  try {
    // Use the client-side Maps JS SDK if it's already loaded (handles HTTP referer restrictions automatically)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (typeof window !== "undefined" && win.google && win.google.maps) {
      return new Promise((resolve) => {
        const geocoder = new win.google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat, lng }, language: "id" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (results: any[], status: string) => {
            if (status === "OK" && results && results.length > 0) {
              let bestAddress = results[0].formatted_address;
              for (const result of results) {
                if (
                  result.types.includes("street_address") ||
                  result.types.includes("route") ||
                  result.types.includes("premise") ||
                  result.types.includes("administrative_area_level_4")
                ) {
                  bestAddress = result.formatted_address;
                  break;
                }
              }
              resolve(bestAddress);
            } else {
              console.error("Client Geocoder failed:", status);
              resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
          },
        );
      });
    }

    // Fallback for SSR or if Maps SDK is not loaded
    const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    const data = await response.json();

    if (data.status !== "OK" && !data.results) {
      console.error(
        "Reverse Geocoding API error:",
        data.status,
        data.error_message || data.error,
      );
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    if (data.results && data.results.length > 0) {
      // Find a result that is specific enough but not just an unnamed road.
      // Usually the first result is the most precise (e.g. premise or street_address),
      // but sometimes it's too specific (just a plus code).
      // We'll iterate to find a good descriptive one.

      let bestAddress = data.results[0].formatted_address;

      for (const result of data.results) {
        // Prefer a 'street_address', 'route', or 'premise' for accuracy
        if (
          result.types.includes("street_address") ||
          result.types.includes("route") ||
          result.types.includes("premise") ||
          result.types.includes("administrative_area_level_4") // Kelurahan/Desa
        ) {
          bestAddress = result.formatted_address;
          break;
        }
      }
      return bestAddress;
    }

    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
