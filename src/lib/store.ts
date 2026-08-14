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
  const existing = metas.find((m) => m.id === meta.id);
  // Preserve publish state across draft saves.
  const merged: PresentationMeta = existing
    ? { ...meta, publishedAt: existing.publishedAt, visibility: existing.visibility }
    : meta;
  const next = [merged, ...metas.filter((m) => m.id !== meta.id)];
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
  // Remove the draft and any published snapshot so deleted decks go offline.
  await supabase.storage
    .from(PRESENTATIONS_BUCKET)
    .remove([docPath(userId, id), `public/${id}.json`]);
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
  sourceOwnerId: string,
  id: string,
  destUserId: string,
  newId: string
): Promise<Presentation | null> {
  const p = await getPresentation(sourceOwnerId, id);
  if (!p) return null;
  const now = new Date().toISOString();
  const copy: Presentation = {
    ...p,
    id: newId,
    title: `${p.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await savePresentation(destUserId, copy);
  return copy;
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/*                                                                     */
/* Publishing writes an immutable snapshot of the presentation to      */
/*   presentations/public/{presentationId}.json                        */
/* served by the public /p/[id] route. Draft edits never touch the     */
/* published snapshot until the user publishes again.                  */
/* ------------------------------------------------------------------ */

export type Visibility = "private" | "link" | "public";

export interface PublishedDoc {
  ownerId: string;
  visibility: Visibility;
  publishedAt: string;
  presentation: Presentation;
}

function publicPath(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid presentation id");
  return `public/${id}.json`;
}

export async function getPublished(id: string): Promise<PublishedDoc | null> {
  let doc: unknown;
  try {
    doc = await download(publicPath(id));
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object") return null;
  const record = doc as PublishedDoc;
  const parsed = PresentationSchema.safeParse(record.presentation);
  if (!parsed.success || typeof record.ownerId !== "string") return null;
  return {
    ownerId: record.ownerId,
    visibility: record.visibility === "public" || record.visibility === "private" ? record.visibility : "link",
    publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : new Date().toISOString(),
    presentation: parsed.data,
  };
}

async function updateIndexPublishState(
  userId: string,
  id: string,
  publish: { publishedAt: string; visibility: Visibility } | null
): Promise<void> {
  const metas = await listPresentations(userId);
  await writeIndex(
    userId,
    metas.map((m) =>
      m.id === id
        ? {
            ...m,
            publishedAt: publish?.publishedAt,
            visibility: publish?.visibility,
          }
        : m
    )
  );
}

/** Publish (or re-publish) the current draft. Returns the published doc. */
export async function publishPresentation(
  userId: string,
  id: string,
  visibility: Visibility
): Promise<PublishedDoc | null> {
  const presentation = await getPresentation(userId, id);
  if (!presentation) return null;
  const published: PublishedDoc = {
    ownerId: userId,
    visibility,
    publishedAt: new Date().toISOString(),
    presentation,
  };
  await upload(publicPath(id), published);
  await updateIndexPublishState(userId, id, {
    publishedAt: published.publishedAt,
    visibility,
  });
  return published;
}

/** Change visibility without republishing content. */
export async function setVisibility(
  userId: string,
  id: string,
  visibility: Visibility
): Promise<PublishedDoc | null> {
  const existing = await getPublished(id);
  if (!existing || existing.ownerId !== userId) return null;
  const updated = { ...existing, visibility };
  await upload(publicPath(id), updated);
  await updateIndexPublishState(userId, id, {
    publishedAt: existing.publishedAt,
    visibility,
  });
  return updated;
}

export async function unpublishPresentation(userId: string, id: string): Promise<boolean> {
  const existing = await getPublished(id);
  if (!existing || existing.ownerId !== userId) return false;
  const supabase = createAdminClient();
  await supabase.storage.from(PRESENTATIONS_BUCKET).remove([publicPath(id)]);
  await updateIndexPublishState(userId, id, null);
  return true;
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
