import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache and rate limiter
// Note: In serverless environments (Vercel edge functions), this might reset across instances
// but since this acts as a global namespace cache for Node.js servers, it works well.
const geocodeCache = new Map<string, any>();
const rateLimitMap = new Map<string, number[]>();

const RATE_LIMIT = 15;
const TIME_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat or lng" }, { status: 400 });
  }

  // Rate Limiting Logic
  const ip = req.headers.get("x-forwarded-for") || "unknown-ip";
  const now = Date.now();
  const requestTimestamps = rateLimitMap.get(ip) || [];

  // Filter out expired timestamps
  const validTimestamps = requestTimestamps.filter(
    (t) => now - t < TIME_WINDOW_MS,
  );

  if (validTimestamps.length >= RATE_LIMIT) {
    return NextResponse.json(
      {
        error: "Too Many Requests. Maximum 15 requests per 10 minutes allowed.",
      },
      { status: 429 },
    );
  }

  // Record current request
  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);

  // Caching Logic
  // Round coordinates slightly to handle micro-movements (e.g. 4 decimal places = ~11 meters)
  const cacheKey = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;

  if (geocodeCache.has(cacheKey)) {
    return NextResponse.json(geocodeCache.get(cacheKey));
  }

  // Use Backend Specific API Key (without referer limits)
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API Key not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=id`,
      {
        headers: {
          Referer: req.headers.get("referer") || req.nextUrl.origin,
        },
      },
    );
    const data = await response.json();

    if (response.ok && data.status === "OK") {
      // Save valid data to cache (keeps the map growing, but bounds it per unique location)
      geocodeCache.set(cacheKey, data);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error connecting to Google Geocoding API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
