import { del, get, put } from "@vercel/blob";
import { createAdminClient, hasSupabaseAdmin } from "./supabase/admin";

/**
 * Server-side object storage used for presentation JSON, share records, and
 * uploaded images. Prefers the Supabase service-role client when that secret
 * is configured; otherwise uses Vercel Blob so the app can persist without it.
 */

export const PRESENTATIONS_BUCKET = "presentations";
export const UPLOADS_BUCKET = "uploads";

export function storageConfigured(): boolean {
  return hasSupabaseAdmin() || Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobPath(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

export async function downloadJson(bucket: string, path: string): Promise<unknown | null> {
  if (hasSupabaseAdmin()) {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    try {
      return JSON.parse(await data.text());
    } catch {
      return null;
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(blobPath(bucket, path), { access: "public", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function uploadJson(bucket: string, path: string, body: unknown): Promise<void> {
  const payload = JSON.stringify(body);
  if (hasSupabaseAdmin()) {
    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, payload, { contentType: "application/json", upsert: true });
    if (error) throw new Error(`Failed to save: ${error.message}`);
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Storage is not configured.");
  }

  await put(blobPath(bucket, path), payload, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  if (hasSupabaseAdmin()) {
    const supabase = createAdminClient();
    await supabase.storage.from(bucket).remove(paths);
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  await del(paths.map((path) => blobPath(bucket, path)));
}

export async function uploadPublicBytes(
  bucket: string,
  path: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<string> {
  if (hasSupabaseAdmin()) {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Image upload failed: ${error.message}`);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Storage is not configured.");
  }

  const blob = await put(blobPath(bucket, path), Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType,
  });
  return blob.url;
}
