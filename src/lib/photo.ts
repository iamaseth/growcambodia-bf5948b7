import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "crop-photos";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function compressAndUploadPhotos(files: File[], userId: string): Promise<string[]> {
  const urls: string[] = [];
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
    const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
    if (signErr || !data) throw signErr ?? new Error("sign failed");
    urls.push(data.signedUrl);
  }
  return urls;
}
