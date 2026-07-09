import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "crop-photos";
// Short-lived URLs; storage paths are what we persist in the DB.
const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours

/**
 * Compresses and uploads photos, returning the storage paths (not URLs).
 * Persist these paths in `image_urls`; the fetch layer signs them on demand
 * so leaked/shared links expire quickly.
 */
export async function compressAndUploadPhotos(files: File[], userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

/**
 * Given stored image_urls entries (paths OR legacy full https URLs), return
 * short-lived signed URLs. Legacy full URLs are returned as-is for back-compat.
 */
export async function signImageUrls(entries: string[]): Promise<string[]> {
  if (!entries.length) return [];
  const toSign: { idx: number; path: string }[] = [];
  const out: string[] = new Array(entries.length);
  entries.forEach((entry, idx) => {
    if (/^https?:\/\//i.test(entry)) {
      out[idx] = entry;
    } else {
      toSign.push({ idx, path: entry });
    }
  });
  if (toSign.length) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(toSign.map((t) => t.path), SIGNED_URL_TTL);
    if (error) throw error;
    (data ?? []).forEach((row, i) => {
      out[toSign[i].idx] = row.signedUrl ?? "";
    });
  }
  return out;
}
