import type { Presentation, PresentationMeta } from "./schema";
import { PresentationSchema } from "./schema";
import {
  PRESENTATIONS_BUCKET,
  UPLOADS_BUCKET,
  downloadJson,
  removeObjects,
  uploadJson,
  uploadPublicBytes,
} from "./object-store";

export { PRESENTATIONS_BUCKET, UPLOADS_BUCKET };

/**
 * Persistence layer for presentation JSON.
 *
 * Every presentation is stored as an isolated JSON document at
 *   presentations/{userId}/{presentationId}.json
 * plus a lightweight per-user index at
 *   presentations/{userId}/index.json
 *
 * Backed by Supabase Storage when a service-role key is present, otherwise
 * Vercel Blob. Ownership is enforced here: all reads/writes are scoped to
 * the authenticated user's prefix, and this module only runs server-side.
 */

function docPath(userId: string, id: string) {
  // Guard against path traversal in ids.
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid presentation id");
  return `${userId}/${id}.json`;
}

function indexPath(userId: string) {
  return `${userId}/index.json`;
}

async function download(path: string): Promise<unknown | null> {
  return downloadJson(PRESENTATIONS_BUCKET, path);
}

async function upload(path: string, body: unknown): Promise<void> {
  await uploadJson(PRESENTATIONS_BUCKET, path, body);
}

export function toMeta(p: Presentation): PresentationMeta {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    kind: p.kind ?? "presentation",
    slideCount: p.kind === "model" ? p.scene?.objects.length ?? 0 : p.slides.length,
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
  const prev = await getPresentation(userId, p.id);
  const next: Presentation = {
    ...p,
    chatThread: p.chatThread ?? prev?.chatThread,
  };
  await upload(docPath(userId, p.id), next);
  await upsertIndexEntry(userId, toMeta(next));
}

export async function deletePresentation(userId: string, id: string): Promise<void> {
  // Remove the draft and any published snapshot so deleted decks go offline.
  await removeObjects(PRESENTATIONS_BUCKET, [docPath(userId, id), `public/${id}.json`]);
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
  await removeObjects(PRESENTATIONS_BUCKET, [publicPath(id)]);
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
  const safeName = fileName.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${userId}/${Date.now()}-${safeName}`;
  return uploadPublicBytes(UPLOADS_BUCKET, path, bytes, contentType);
}
