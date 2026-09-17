import type { SourceImage } from './composition';

/**
 * Image intake. Files are read into an object URL and decoded in the page —
 * nothing is uploaded, and there is no server to upload to.
 */

export const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

export class ImageLoadError extends Error {}

/** Decode a file into something both an <img> and drawImage() can use. */
export async function loadImage(file: File | Blob, fallbackName = 'screenshot'): Promise<SourceImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageLoadError('That file is not an image.');
  }

  const name = file instanceof File && file.name ? file.name : fallbackName;
  const objectUrl = URL.createObjectURL(file);
  const element = new Image();

  // Not strictly needed for same-origin blobs, but keeps the canvas untainted
  // if the source ever changes.
  element.crossOrigin = 'anonymous';
  element.src = objectUrl;

  try {
    await element.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new ImageLoadError('That image could not be decoded.');
  }

  const width = element.naturalWidth;
  const height = element.naturalHeight;

  if (!width || !height) {
    URL.revokeObjectURL(objectUrl);
    throw new ImageLoadError('That image has no dimensions.');
  }

  return { element, objectUrl, width, height, name };
}

/** The first image in a drop or paste payload, if there is one. */
export function firstImageFile(data: DataTransfer | null): File | null {
  if (!data) return null;

  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith('image/')) return file;
  }

  return null;
}
