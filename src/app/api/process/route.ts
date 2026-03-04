import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import piexif from "piexifjs";

export async function POST(req: NextRequest) {
  console.log("Processing started...");
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    console.log("File received:", file?.name, "Size:", file?.size);
    // ... rest of code

    const lat = parseFloat(formData.get("lat") as string);
    const lng = parseFloat(formData.get("lng") as string);
    const address = (formData.get("address") as string) || "";
    const dateStr = formData.get("date") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Parsing happens later manually

    // 2. Prepare Overlay (Open Camera Style - Transparent)
    // Design: Map on left, Text on right. Transparent background. Strong text shadows.

    // Helper to escape XML special characters
    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case "&":
            return "&amp;";
          case "'":
            return "&apos;";
          case '"':
            return "&quot;";
          default:
            return c;
        }
      });
    };

    // Manual Date Parsing to bypass Timezone execution environment issues entirely
    // We expect dateStr to be in ISO-like format (e.g. 2023-11-25T14:30:00) sent from frontend
    const parseDateRaw = (str: string) => {
      const parts = str.split(/[^0-9]/).filter(Boolean);
      return {
        year: parts[0] || "2000",
        month: parts[1] || "01",
        day: parts[2] || "01",
        hour: parts[3] || "00",
        minute: parts[4] || "00",
        second: parts[5] || "00",
      };
    };

    const dRaw = parseDateRaw(dateStr);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthName = months[parseInt(dRaw.month, 10) - 1] || "Jan";

    // Format Date/Time
    const timeStr = `${dRaw.hour}:${dRaw.minute}:${dRaw.second}`;
    const dateStrShort = `${parseInt(dRaw.day, 10)} ${monthName} ${dRaw.year}`;
    const dateTimeStr = escapeXml(`${dateStrShort} ${timeStr}`);

    // Coordinates
    const latRef = lat >= 0 ? "N" : "S";
    const lngRef = lng >= 0 ? "E" : "W";
    const coordsStr = escapeXml(
      `${Math.abs(lat).toFixed(5)}° ${latRef}, ${Math.abs(lng).toFixed(5)}° ${lngRef}`,
    );

    // Address wrapping
    const addrParts = address.split(",").map((s) => s.trim());
    const addressLines = [];
    let currentLine = "";

    // Simple word wrap
    const words = address.split(" ");
    for (const word of words) {
      if ((currentLine + " " + word).length < 35) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        addressLines.push(currentLine);
        currentLine = word;
      }
    }
    addressLines.push(currentLine);

    const finalAddrLines = addressLines.slice(0, 3);
    if (addressLines.length > 3)
      finalAddrLines[finalAddrLines.length - 1] += "...";

    // ... Metadata and Layout Calculation ...
    // Note: .metadata() returns the metadata of the INPUT image.
    // If we are going to .rotate() later, we need to account for swapped dimensions now.
    const metadata = await sharp(buffer).metadata();
    let width = metadata.width || 1000;
    let height = metadata.height || 1000;

    const orientation = metadata.orientation || 1;
    if (orientation >= 5 && orientation <= 8) {
      // 5-8 means the image is rotated 90 or 270 degrees.
      // We must swap width and height to calculate layout for the final upright image.
      [width, height] = [height, width];
    }

    const overlayWidth = Math.floor(width * 0.95);
    const fontSizeMain = Math.floor(width * 0.035);
    const fontSizeSub = Math.floor(width * 0.03);
    const lineHeight = Math.floor(fontSizeSub * 1.3);

    const totalLines = 2 + finalAddrLines.length;
    const textBlockHeight = totalLines * lineHeight;
    // Map size - make it match text height or slightly larger
    const mapSize = Math.floor(textBlockHeight * 1.2);

    // Fetch Google Static Map
    console.log(`Fetching Google Static Map for ${lat}, ${lng}...`);
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API Key is not configured.");
    }

    const scale = mapSize > 500 ? 2 : 1;
    // We request size/scale to fit mapSize
    const reqSize = Math.floor(mapSize / scale);
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=17&size=${reqSize}x${reqSize}&scale=${scale}&maptype=roadmap&markers=color:blue%7C${lat},${lng}&key=${apiKey}`;

    const mapRes = await fetch(mapUrl, {
      headers: {
        Referer: req.headers.get("referer") || req.nextUrl.origin,
      },
    });
    if (!mapRes.ok) {
      throw new Error(
        `Failed to fetch Google Static Map: ${mapRes.statusText}`,
      );
    }
    const mapTileBuffer = Buffer.from(await mapRes.arrayBuffer());
    console.log("Map fetched successfully.");

    // Map Border and Resize
    console.log("Compositing map border...");

    const processedMap = await sharp(mapTileBuffer)
      .resize(mapSize, mapSize)
      .composite([
        {
          input: Buffer.from(
            `<svg width="${mapSize}" height="${mapSize}"><rect x="0" y="0" width="${mapSize}" height="${mapSize}" rx="${Math.floor(mapSize / 20)}" ry="${Math.floor(mapSize / 20)}" fill="none" stroke="white" stroke-width="${Math.max(2, Math.floor(width / 200))}"/></svg>`,
          ),
          blend: "over",
        },
      ])
      .toBuffer();

    // Generate Text SVG lines
    let textSVG = "";
    let currentY = (mapSize - textBlockHeight) / 2 + fontSizeMain;

    textSVG += `<text x="100%" y="${currentY}" class="main">${dateTimeStr}</text>`;
    currentY += lineHeight;

    textSVG += `<text x="100%" y="${currentY}" class="sub">${coordsStr}</text>`;
    currentY += lineHeight;

    for (const line of finalAddrLines) {
      textSVG += `<text x="100%" y="${currentY}" class="sub">${escapeXml(line.replace(/,/g, ""))}</text>`;
      currentY += lineHeight;
    }

    const svgOverlay = `
    <svg width="${overlayWidth - mapSize - 20}" height="${mapSize}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .main { font-family: sans-serif; font-weight: 700; font-size: ${fontSizeMain}px; fill: white; text-anchor: end; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.9)); }
          .sub { font-family: sans-serif; font-weight: 400; font-size: ${fontSizeSub}px; fill: white; text-anchor: end; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.9)); }
        </style>
      </defs>
      ${textSVG}
    </svg>
    `;

    // Composite Map and Text
    // We position the map on the left (relative to overlay area)
    // We position the text on the right
    // The overlay area is placed at the bottom of the image

    // Text buffer
    const textBuffer = Buffer.from(svgOverlay);

    const bottomPadding = Math.floor(height * 0.05);
    const leftPosMap = Math.floor(width * 0.05); // 5% from left
    const topPos = height - mapSize - bottomPadding;

    const rightPosText = width - Math.floor(width * 0.05); // Right align reference
    const leftPosText = rightPosText - (overlayWidth - mapSize - 20); // Calculate left pos to make it end at rightPosText?
    // Wait, SVG width is (overlayWidth - mapSize - 20).
    // And inside SVG, text-anchor is "end" and x="100%".
    // So if we place this SVG at (RightEdge - SVGWidth), the text will align to RightEdge.

    const textLeftPos =
      width - (overlayWidth - mapSize - 20) - Math.floor(width * 0.05);

    console.log("Compositing final image...");
    const processedImageBuffer = await sharp(buffer)
      .rotate() // Auto-rotate here as well
      .composite([
        { input: processedMap, top: topPos, left: leftPosMap },
        { input: textBuffer, top: topPos, left: textLeftPos },
      ])
      .withMetadata() // Keep original metadata
      .jpeg({ quality: 95 }) // Force JPEG
      .toBuffer();

    // 4. Update Exif (GPS) using piexifjs (Pure JS)
    console.log("Generating Exif data...");

    const zeroth: { [key: string]: any } = {};
    const exif: { [key: string]: any } = {};
    const gps: { [key: string]: any } = {};

    zeroth[piexif.ImageIFD.Make] = "TaimStem";
    zeroth[piexif.ImageIFD.Model] = "Web App";
    zeroth[piexif.ImageIFD.Software] = "TaimStem v1.0";
    zeroth[piexif.ImageIFD.DateTime] = dateStr
      .replace(/[-:]/g, ":")
      .replace("T", " ");

    exif[piexif.ExifIFD.DateTimeOriginal] = dateStr
      .replace(/[-:]/g, ":")
      .replace("T", " ");
    exif[piexif.ExifIFD.UserComment] = `Stamped at ${address}`;

    // GPS Helper
    const degToDms = (
      deg: number,
    ): [[number, number], [number, number], [number, number]] => {
      const d = Math.floor(deg);
      const minFloat = (deg - d) * 60;
      const m = Math.floor(minFloat);
      const s = Math.round((minFloat - m) * 60 * 100) / 100;
      return [
        [d, 1],
        [m, 1],
        [Math.round(s * 100), 100],
      ];
    };

    gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
    gps[piexif.GPSIFD.GPSLatitude] = degToDms(Math.abs(lat));
    gps[piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? "E" : "W";
    gps[piexif.GPSIFD.GPSLongitude] = degToDms(Math.abs(lng));

    const exifObj = { "0th": zeroth, Exif: exif, GPS: gps };
    const exifBytes = piexif.dump(exifObj);

    // Insert Exif into JPEG
    // piexif.insert returns the new JPEG as a binary string
    // We need to convert Buffer -> BinaryString -> Insert -> Buffer
    const jpegBinary = processedImageBuffer.toString("binary");
    const newJpegBinary = piexif.insert(exifBytes, jpegBinary);
    const finalBuffer = Buffer.from(newJpegBinary, "binary");

    console.log("Process complete, returning response.");
    return new NextResponse(new Blob([finalBuffer as unknown as BlobPart]), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="stamped_${file.name}"`,
      },
    });
  } catch (error: any) {
    console.error("Processing error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown processing error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
