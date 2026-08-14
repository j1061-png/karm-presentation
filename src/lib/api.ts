"use client";

import type { Presentation, PresentationMeta } from "./schema";

/** Thin client for the present@karm API routes. */

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export async function listPresentations(): Promise<PresentationMeta[]> {
  const { presentations } = await json<{ presentations: PresentationMeta[] }>(
    await fetch("/api/presentations")
  );
  return presentations;
}

export async function getPresentation(id: string): Promise<Presentation> {
  const { presentation } = await json<{ presentation: Presentation }>(
    await fetch(`/api/presentations/${id}`)
  );
  return presentation;
}

export async function createPresentation(input?: {
  title?: string;
  presentation?: Partial<Presentation>;
}): Promise<Presentation> {
  const { presentation } = await json<{ presentation: Presentation }>(
    await fetch("/api/presentations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    })
  );
  return presentation;
}

export async function savePresentation(p: Presentation): Promise<Presentation> {
  const { presentation } = await json<{ presentation: Presentation }>(
    await fetch(`/api/presentations/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presentation: p }),
    })
  );
  return presentation;
}

export async function renamePresentation(id: string, title: string): Promise<void> {
  await json(
    await fetch(`/api/presentations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
  );
}

export async function deletePresentation(id: string): Promise<void> {
  await json(await fetch(`/api/presentations/${id}`, { method: "DELETE" }));
}

export async function duplicatePresentation(id: string): Promise<Presentation> {
  const { presentation } = await json<{ presentation: Presentation }>(
    await fetch(`/api/presentations/${id}/duplicate`, { method: "POST" })
  );
  return presentation;
}

export interface UploadedSource {
  name: string;
  kind: string;
  content: string;
  imageUrl?: string;
}

export async function extractFile(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadedSource> {
  // Use XHR for real upload progress events.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/extract");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.file);
        else reject(new Error(body.error ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export interface AIEditResult {
  summary: string;
  presentation: Presentation;
  changed: boolean;
}

export async function aiEdit(input: {
  presentationId: string;
  instruction: string;
  presentation: Presentation;
  selectedSlideId?: string;
  selectedElementId?: string;
}): Promise<AIEditResult> {
  return json<AIEditResult>(
    await fetch("/api/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}
