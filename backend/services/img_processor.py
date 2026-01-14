from PIL import Image, ImageDraw, ImageFont
import piexif
from datetime import datetime

def process_image(
    input_path,
    output_path,
    location_text,
    lat,
    lng,
    altitude,
    timestamp
):
    img = Image.open(input_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    font = ImageFont.truetype("arial.ttf", 28)

    overlay = (
        f"{timestamp.strftime('%H:%M')} | {timestamp.strftime('%b %d, %Y')}\n"
        f"GMT+7\n"
        f"{location_text}\n"
        f"{lat:.6f} S, {lng:.6f} E  ▲{altitude}m"
    )

    padding = 20
    x = padding
    y = img.height - 220

    draw.rectangle(
        (10, y - 10, img.width - 10, img.height - 10),
        fill=(0, 0, 0, 150)
    )

    draw.multiline_text(
        (x, y),
        overlay,
        font=font,
        fill=(255, 255, 255),
        spacing=6
    )

    exif_dict = piexif.load(img.info.get("exif", b""))

    exif_dict["0th"][piexif.ImageIFD.DateTime] = timestamp.strftime(
        "%Y:%m:%d %H:%M:%S"
    )

    exif_dict["GPS"] = {
        piexif.GPSIFD.GPSLatitude: [(int(abs(lat)), 1), (0, 1), (0, 1)],
        piexif.GPSIFD.GPSLongitude: [(int(abs(lng)), 1), (0, 1), (0, 1)],
    }

    img.save(output_path, exif=piexif.dump(exif_dict))
