"use client";

import type { Presentation, PresentationMeta } from "./schema";

/** Thin client for the Studio API routes. */

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

export type Visibility = "private" | "link" | "public";

export interface PublishStatus {
  published: boolean;
  publishedAt?: string;
  visibility?: Visibility;
  hasUnpublishedChanges?: boolean;
}

export async function getPublishStatus(id: string): Promise<PublishStatus> {
  return json<PublishStatus>(await fetch(`/api/presentations/${id}/publish`));
}

export async function publishPresentation(id: string, visibility: Visibility): Promise<PublishStatus> {
  return json<PublishStatus>(
    await fetch(`/api/presentations/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    })
  );
}

export async function setPublishVisibility(id: string, visibility: Visibility): Promise<PublishStatus> {
  return json<PublishStatus>(
    await fetch(`/api/presentations/${id}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    })
  );
}

export async function unpublishPresentation(id: string): Promise<PublishStatus> {
  return json<PublishStatus>(
    await fetch(`/api/presentations/${id}/publish`, { method: "DELETE" })
  );
}

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  role: "editor";
  status: "pending" | "accepted" | "declined";
  invitedAt: string;
}

export interface CollaboratorsPayload {
  owner: { userId: string; email: string; name: string };
  collaborators: Collaborator[];
  role: "owner" | "editor";
}

export async function getCollaborators(id: string): Promise<CollaboratorsPayload> {
  return json<CollaboratorsPayload>(await fetch(`/api/presentations/${id}/collaborators`));
}

export async function inviteCollaborator(id: string, email: string): Promise<CollaboratorsPayload> {
  return json<CollaboratorsPayload>(
    await fetch(`/api/presentations/${id}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );
}

export async function removeCollaborator(id: string, userId: string): Promise<void> {
  await json(
    await fetch(`/api/presentations/${id}/collaborators`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
  );
}

export async function leavePresentation(id: string): Promise<void> {
  await json(
    await fetch(`/api/presentations/${id}/collaborators`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
  );
}

export interface AppNotification {
  id: string;
  type: "invite" | "invite-accepted" | "invite-declined";
  createdAt: string;
  read: boolean;
  presentationId: string;
  presentationTitle: string;
  from: { userId: string; name: string; email: string };
  inviteStatus?: "pending" | "accepted" | "declined";
}

export async function listNotifications(): Promise<AppNotification[]> {
  const { notifications } = await json<{ notifications: AppNotification[] }>(
    await fetch("/api/notifications")
  );
  return notifications;
}

export async function respondToInvite(
  id: string,
  action: "accept" | "decline"
): Promise<AppNotification[]> {
  const { notifications } = await json<{ notifications: AppNotification[] }>(
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    })
  );
  return notifications;
}

export async function markNotificationsRead(ids?: string[]): Promise<AppNotification[]> {
  const { notifications } = await json<{ notifications: AppNotification[] }>(
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", ids }),
    })
  );
  return notifications;
}

export async function deleteAccount(): Promise<void> {
  await json(await fetch("/api/account", { method: "DELETE" }));
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
  files?: UploadedSource[];
}): Promise<AIEditResult> {
  return json<AIEditResult>(
    await fetch("/api/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

// ---------------------------------------------------------------------------
// Custom domains
// ---------------------------------------------------------------------------

export interface DomainInfo {
  hostname: string;
  projectId: string;
  source: "purchased" | "connected";
  status: "pending_dns" | "active" | "error";
  error?: string;
}

export interface DomainList {
  domains: DomainInfo[];
  purchaseConfigured: boolean;
  connectConfigured: boolean;
  appHost: string | null;
}

export async function listDomains(projectId?: string): Promise<DomainList> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return json<DomainList>(await fetch(`/api/domains${qs}`));
}

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  priceCents: number | null;
}

export async function searchDomain(q: string): Promise<DomainSearchResult> {
  return json<DomainSearchResult>(await fetch(`/api/domains/search?q=${encodeURIComponent(q)}`));
}

export async function checkoutDomain(domain: string, projectId: string): Promise<{ url: string }> {
  return json<{ url: string }>(
    await fetch("/api/domains/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, projectId }),
    })
  );
}

export interface ConnectDomainResult {
  domain: DomainInfo;
  dns: { type: string; host: string; value: string; note: string };
}

export async function connectDomain(hostname: string, projectId: string): Promise<ConnectDomainResult> {
  return json<ConnectDomainResult>(
    await fetch("/api/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname, projectId }),
    })
  );
}

export async function removeDomain(hostname: string): Promise<void> {
  await json(
    await fetch(`/api/domains?hostname=${encodeURIComponent(hostname)}`, { method: "DELETE" })
  );
}
