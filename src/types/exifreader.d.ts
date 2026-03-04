declare module "exifreader" {
  export interface ExifTags {
    [key: string]: any;
    GPSLatitude?: { description: string | number; value: any };
    GPSLongitude?: { description: string | number; value: any };
    GPSLatitudeRef?: { description: string; value: string[] };
    GPSLongitudeRef?: { description: string; value: string[] };
  }

  export function load(
    file: File | Blob | ArrayBuffer | string,
  ): Promise<ExifTags>;

  interface ExifReader {
    load: typeof load;
  }

  const ExifReader: ExifReader;
  export default ExifReader;
}
