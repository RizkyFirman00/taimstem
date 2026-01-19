import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import piexif from "piexifjs";

// Helper to convert lat/lon to tile coordinates (exact)
function lon2tile(lon: number, zoom: number) {
  return ((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat: number, zoom: number) {
  return ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

// Helper to fetch a single raw tile
async function fetchRawTile(x: number, y: number, zoom: number): Promise<Buffer> {
  const providers = [
    `https://tile.openstreetmap.de/${zoom}/${x}/${y}.png`, // OSM Germany (often reliable)
    `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`, // OSM Standard A
    `https://b.tile.openstreetmap.org/${zoom}/${x}/${y}.png`, // OSM Standard B
    `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${zoom}/${x}/${y}.png` // CartoDB
  ];

  for (const url of providers) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        headers: { 
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
      
      if (!res.ok) continue;
      
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (e) {
      // console.warn(`Failed to fetch tile from ${url}:`, e);
      continue;
    }
  }
  
  // Return transparent tile if failed
  return await sharp({
      create: {
          width: 256, height: 256, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 255 } 
      }
  }).png().toBuffer();
}

async function getCenteredMap(lat: number, lng: number, width: number, height: number): Promise<Buffer> {
   const zoom = 17;
   const tileSize = 256;
   
   // Exact global pixel coordinates of the center point
   const exactTileX = lon2tile(lng, zoom);
   const exactTileY = lat2tile(lat, zoom);
   
   const centerX = exactTileX * tileSize;
   const centerY = exactTileY * tileSize;
   
   // Calculate the bounds of the viewport in global pixels
   const left = Math.floor(centerX - (width / 2));
   const top = Math.floor(centerY - (height / 2));
   const right = left + width;
   const bottom = top + height;
   
   // Determine which tiles cover this area
   const minTx = Math.floor(left / tileSize);
   const maxTx = Math.floor(right / tileSize);
   const minTy = Math.floor(top / tileSize);
   const maxTy = Math.floor(bottom / tileSize);
   
   const totalCanvasW = (maxTx - minTx + 1) * tileSize;
   const totalCanvasH = (maxTy - minTy + 1) * tileSize;
   
   // Fetch all needed tiles
   const compositeOps = [];
   
   for (let tx = minTx; tx <= maxTx; tx++) {
       for (let ty = minTy; ty <= maxTy; ty++) {
           const tileBuffer = await fetchRawTile(tx, ty, zoom);
           compositeOps.push({
               input: tileBuffer,
               top: (ty - minTy) * tileSize,
               left: (tx - minTx) * tileSize
           });
       }
   }
   
   // Composite full canvas
   const fullCanvas = await sharp({
       create: {
           width: totalCanvasW,
           height: totalCanvasH,
           channels: 4,
           background: { r: 0, g: 0, b: 0, alpha: 0 }
       }
   })
   .composite(compositeOps)
   .png()
   .toBuffer();
   
   // Crop to the exact viewport
   // Ensure crop coordinates are valid relative to the fullCanvas
   // The (left, top) of fullCanvas in global pixels is (minTx * 256, minTy * 256)
   const cropLeft = left - (minTx * tileSize);
   const cropTop = top - (minTy * tileSize);
   
   return await sharp(fullCanvas)
       .extract({ left: cropLeft, top: cropTop, width: width, height: height })
       .toBuffer();
}

export async function POST(req: NextRequest) {
  console.log("Processing started...");
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    console.log("File received:", file?.name, "Size:", file?.size);
    // ... rest of code

    const lat = parseFloat(formData.get("lat") as string);
    const lng = parseFloat(formData.get("lng") as string);
    const address = formData.get("address") as string || "";
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
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
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
             second: parts[5] || "00"
         };
    };

    const dRaw = parseDateRaw(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = months[parseInt(dRaw.month, 10) - 1] || "Jan";

    // Format Date/Time
    const timeStr = `${dRaw.hour}:${dRaw.minute}:${dRaw.second}`;
    const dateStrShort = `${parseInt(dRaw.day, 10)} ${monthName} ${dRaw.year}`;
    const dateTimeStr = escapeXml(`${dateStrShort} ${timeStr}`);
    
    // Coordinates
    const latRef = lat >= 0 ? "N" : "S";
    const lngRef = lng >= 0 ? "E" : "W";
    const coordsStr = escapeXml(`${Math.abs(lat).toFixed(5)}° ${latRef}, ${Math.abs(lng).toFixed(5)}° ${lngRef}`);
    
    // Address wrapping
    const addrParts = address.split(',').map(s => s.trim());
    const addressLines = [];
    let currentLine = "";
    
    // Simple word wrap
    const words = address.split(' '); 
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
    if (addressLines.length > 3) finalAddrLines[finalAddrLines.length-1] += "...";

    // ... Metadata and Layout Calculation ...
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    
    const overlayWidth = Math.floor(width * 0.95);
    const fontSizeMain = Math.floor(width * 0.035); 
    const fontSizeSub = Math.floor(width * 0.03);   
    const lineHeight = Math.floor(fontSizeSub * 1.3);
    
    const totalLines = 2 + finalAddrLines.length; 
    const textBlockHeight = totalLines * lineHeight;
    // Map size - make it match text height or slightly larger
    const mapSize = Math.floor(textBlockHeight * 1.2); 
    
    // Fetch Centered Map
    console.log(`Fetching centered map for ${lat}, ${lng}...`);
    const mapTileBuffer = await getCenteredMap(lat, lng, mapSize, mapSize);
    console.log("Map fetched successfully.");
    
    // Add Dot Marker to Map (Exactly Center)
    const markerSize = 40;
    const markerSvg = `<svg width="${markerSize}" height="${markerSize}"><circle cx="${markerSize/2}" cy="${markerSize/2}" r="${(markerSize/2)-3}" fill="#3b82f6" stroke="white" stroke-width="4"/></svg>`;
    
    const mapWithMarker = await sharp(mapTileBuffer)
        .composite([{
            input: Buffer.from(markerSvg),
            // Center of mapSize
            top: Math.floor((mapSize - markerSize) / 2),
            left: Math.floor((mapSize - markerSize) / 2)
        }])
        .toBuffer();
    
    // Map Border and Resize
    console.log("Compositing map border...");
    const processedMap = await sharp(mapWithMarker)
      .resize(mapSize, mapSize)
      .composite([{
         input: Buffer.from(`<svg width="${mapSize}" height="${mapSize}"><rect x="0" y="0" width="${mapSize}" height="${mapSize}" rx="${Math.floor(mapSize/20)}" ry="${Math.floor(mapSize/20)}" fill="none" stroke="white" stroke-width="${Math.max(2, Math.floor(width/200))}"/></svg>`),
         blend: 'over'
      }])
      .toBuffer();

    // Generate Text SVG lines
    let textSVG = "";
    let currentY = (mapSize - textBlockHeight) / 2 + fontSizeMain; 
    
    textSVG += `<text x="100%" y="${currentY}" class="main">${dateTimeStr}</text>`;
    currentY += lineHeight;
    
    textSVG += `<text x="100%" y="${currentY}" class="sub">${coordsStr}</text>`;
    currentY += lineHeight;
    
    for (const line of finalAddrLines) {
        textSVG += `<text x="100%" y="${currentY}" class="sub">${escapeXml(line.replace(/,/g, ''))}</text>`;
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
    
    const textLeftPos = width - (overlayWidth - mapSize - 20) - Math.floor(width * 0.05);

    console.log("Compositing final image...");
    const processedImageBuffer = await sharp(buffer)
      .composite([
        { input: processedMap, top: topPos, left: leftPosMap },
        { input: textBuffer, top: topPos, left: textLeftPos }
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
    zeroth[piexif.ImageIFD.DateTime] = dateStr.replace(/[-:]/g, ':').replace('T', ' ');
    
    exif[piexif.ExifIFD.DateTimeOriginal] = dateStr.replace(/[-:]/g, ':').replace('T', ' ');
    exif[piexif.ExifIFD.UserComment] = `Stamped at ${address}`;
    
    // GPS Helper
    const degToDms = (deg: number): [[number, number], [number, number], [number, number]] => {
        const d = Math.floor(deg);
        const minFloat = (deg - d) * 60;
        const m = Math.floor(minFloat);
        const s = Math.round((minFloat - m) * 60 * 100) / 100;
        return [[d, 1], [m, 1], [Math.round(s * 100), 100]];
    };

    gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
    gps[piexif.GPSIFD.GPSLatitude] = degToDms(Math.abs(lat));
    gps[piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? "E" : "W";
    gps[piexif.GPSIFD.GPSLongitude] = degToDms(Math.abs(lng));
    
    const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
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
    const errorMessage = error instanceof Error ? error.message : "Unknown processing error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
