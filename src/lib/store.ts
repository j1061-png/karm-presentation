import { createAdminClient } from "./supabase/admin";
import type { Presentation, PresentationMeta } from "./schema";
import { PresentationSchema } from "./schema";

/**
 * Persistence layer backed by a private Supabase Storage bucket.
 *
 * Every presentation is stored as an isolated JSON document at
 *   presentations/{userId}/{presentationId}.json
 * plus a lightweight per-user index at
 *   presentations/{userId}/index.json
 *
 * Ownership is enforced here: all reads/writes are scoped to the
 * authenticated user's prefix, and this module only runs server-side
 * (clients never receive the secret key).
 */

export const PRESENTATIONS_BUCKET = "presentations";
export const UPLOADS_BUCKET = "uploads";

function docPath(userId: string, id: string) {
  // Guard against path traversal in ids.
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid presentation id");
  return `${userId}/${id}.json`;
}

function indexPath(userId: string) {
  return `${userId}/index.json`;
}

async function download(path: string): Promise<unknown | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(PRESENTATIONS_BUCKET).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function upload(path: string, body: unknown): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PRESENTATIONS_BUCKET)
    .upload(path, JSON.stringify(body), { contentType: "application/json", upsert: true });
  if (error) throw new Error(`Failed to save: ${error.message}`);
}

export function toMeta(p: Presentation): PresentationMeta {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    slideCount: p.slides.length,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    themeColors: {
      background: p.theme.colors.background,
      accent: p.theme.colors.accent,
      text: p.theme.colors.text,
      surface: p.theme.colors.surface,
    },
    preview: p.slides[0] ?? null,
  };
}

export async function listPresentations(userId: string): Promise<PresentationMeta[]> {
  const index = await download(indexPath(userId));
  if (!Array.isArray(index)) return [];
  return (index as PresentationMeta[]).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

async function writeIndex(userId: string, metas: PresentationMeta[]): Promise<void> {
  await upload(indexPath(userId), metas);
}

async function upsertIndexEntry(userId: string, meta: PresentationMeta): Promise<void> {
  const metas = await listPresentations(userId);
  const next = [meta, ...metas.filter((m) => m.id !== meta.id)];
  await writeIndex(userId, next);
}

export async function getPresentation(
  userId: string,
  id: string
): Promise<Presentation | null> {
  const doc = await download(docPath(userId, id));
  if (!doc) return null;
  const parsed = PresentationSchema.safeParse(doc);
  return parsed.success ? parsed.data : null;
}

export async function savePresentation(userId: string, p: Presentation): Promise<void> {
  await upload(docPath(userId, p.id), p);
  await upsertIndexEntry(userId, toMeta(p));
}

export async function deletePresentation(userId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(PRESENTATIONS_BUCKET).remove([docPath(userId, id)]);
  const metas = await listPresentations(userId);
  await writeIndex(userId, metas.filter((m) => m.id !== id));
}

export async function renamePresentation(
  userId: string,
  id: string,
  title: string
): Promise<Presentation | null> {
  const p = await getPresentation(userId, id);
  if (!p) return null;
  const next = { ...p, title, updatedAt: new Date().toISOString() };
  await savePresentation(userId, next);
  return next;
}

export async function duplicatePresentation(
  userId: string,
  id: string,
  newId: string
): Promise<Presentation | null> {
  const p = await getPresentation(userId, id);
  if (!p) return null;
  const now = new Date().toISOString();
  const copy: Presentation = {
    ...p,
    id: newId,
    title: `${p.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await savePresentation(userId, copy);
  return copy;
}

/** Upload a user image to the public uploads bucket; returns its public URL. */
export async function uploadImage(
  userId: string,
  fileName: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<string> {
  const supabase = createAdminClient();
  const safeName = fileName.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
