import { nanoid } from "nanoid";
import { createAdminClient } from "./supabase/admin";
import type { Presentation, PresentationMeta } from "./schema";
import { getPresentation, listPresentations, savePresentation, toMeta } from "./store";
import { PRESENTATIONS_BUCKET } from "./store";
import type { UserProfile } from "./profile";

export type InviteStatus = "pending" | "accepted" | "declined";

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  role: "editor";
  status: InviteStatus;
  invitedAt: string;
}

export interface ShareRecord {
  presentationId: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  collaborators: Collaborator[];
}

export interface AppNotification {
  id: string;
  type: "invite" | "invite-accepted" | "invite-declined";
  createdAt: string;
  read: boolean;
  presentationId: string;
  presentationTitle: string;
  from: { userId: string; name: string; email: string };
  inviteStatus?: InviteStatus;
}

export interface Access {
  ownerId: string;
  role: "owner" | "editor";
}

function sharePath(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error("Invalid presentation id");
  return `shares/${id}.json`;
}

function inboxPath(userId: string) {
  return `${userId}/inbox.json`;
}

function sharedIndexPath(userId: string) {
  return `${userId}/shared.json`;
}

function directoryPath(email: string) {
  const key = email.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, "_");
  if (!key.includes("@")) throw new Error("Invalid email");
  return `directory/${key}.json`;
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

async function remove(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createAdminClient();
  await supabase.storage.from(PRESENTATIONS_BUCKET).remove(paths);
}

export async function registerDirectory(profile: UserProfile): Promise<void> {
  if (!profile.email) return;
  try {
    await upload(directoryPath(profile.email), profile);
  } catch {
    /* directory is best-effort */
  }
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;

  try {
    const cached = await download(directoryPath(normalized));
    if (cached && typeof cached === "object" && "userId" in cached) {
      return cached as UserProfile;
    }
  } catch {
    /* fall through to admin lookup */
  }

  const supabase = createAdminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (url && secret) {
    try {
      const res = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`, {
        headers: { Authorization: `Bearer ${secret}`, apikey: secret },
      });
      if (res.ok) {
        const body = (await res.json()) as { users?: { id: string; email?: string; user_metadata?: Record<string, string> }[] };
        const match = body.users?.find((u) => u.email?.toLowerCase() === normalized);
        if (match) {
          return {
            userId: match.id,
            email: match.email ?? normalized,
            name: match.user_metadata?.full_name || match.user_metadata?.name || normalized.split("@")[0],
            avatarUrl: match.user_metadata?.avatar_url ?? null,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
  if (!match) return null;
  return {
    userId: match.id,
    email: match.email ?? normalized,
    name:
      (match.user_metadata?.full_name as string | undefined) ||
      (match.user_metadata?.name as string | undefined) ||
      normalized.split("@")[0],
    avatarUrl: (match.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}

export async function getShare(id: string): Promise<ShareRecord | null> {
  const doc = await download(sharePath(id));
  if (!doc || typeof doc !== "object") return null;
  const rec = doc as ShareRecord;
  if (typeof rec.ownerId !== "string" || !Array.isArray(rec.collaborators)) return null;
  return rec;
}

async function writeShare(share: ShareRecord): Promise<void> {
  await upload(sharePath(share.presentationId), share);
}

async function getInbox(userId: string): Promise<AppNotification[]> {
  const doc = await download(inboxPath(userId));
  return Array.isArray(doc) ? (doc as AppNotification[]) : [];
}

async function writeInbox(userId: string, items: AppNotification[]): Promise<void> {
  await upload(inboxPath(userId), items.slice(0, 80));
}

async function pushNotification(userId: string, item: AppNotification): Promise<void> {
  const inbox = await getInbox(userId);
  await writeInbox(userId, [item, ...inbox.filter((n) => n.id !== item.id)]);
}

async function getSharedIndex(userId: string): Promise<PresentationMeta[]> {
  const doc = await download(sharedIndexPath(userId));
  return Array.isArray(doc) ? (doc as PresentationMeta[]) : [];
}

async function writeSharedIndex(userId: string, metas: PresentationMeta[]): Promise<void> {
  await upload(sharedIndexPath(userId), metas);
}

async function upsertSharedIndex(userId: string, meta: PresentationMeta): Promise<void> {
  const list = await getSharedIndex(userId);
  await writeSharedIndex(userId, [meta, ...list.filter((m) => m.id !== meta.id)]);
}

async function removeFromSharedIndex(userId: string, presentationId: string): Promise<void> {
  const list = await getSharedIndex(userId);
  await writeSharedIndex(userId, list.filter((m) => m.id !== presentationId));
}

export async function resolveAccess(userId: string, id: string): Promise<Access | null> {
  const own = await getPresentation(userId, id);
  if (own) return { ownerId: userId, role: "owner" };
  const share = await getShare(id);
  if (!share) return null;
  const collab = share.collaborators.find((c) => c.userId === userId && c.status === "accepted");
  if (!collab) return null;
  return { ownerId: share.ownerId, role: "editor" };
}

export async function getAccessiblePresentation(
  userId: string,
  id: string
): Promise<{ presentation: Presentation; access: Access } | null> {
  const access = await resolveAccess(userId, id);
  if (!access) return null;
  const presentation = await getPresentation(access.ownerId, id);
  if (!presentation) return null;
  return { presentation, access };
}

export async function saveAccessiblePresentation(userId: string, p: Presentation): Promise<void> {
  const access = await resolveAccess(userId, p.id);
  if (!access) throw new Error("Not found");
  await savePresentation(access.ownerId, p);
  await refreshSharedIndexes(p.id);
}

export async function listAccessiblePresentations(userId: string): Promise<PresentationMeta[]> {
  const own = (await listPresentations(userId)).map((m) => ({ ...m, role: "owner" as const }));
  const shared = await getSharedIndex(userId);
  const seen = new Set(own.map((m) => m.id));
  const extras = shared.filter((m) => !seen.has(m.id)).map((m) => ({ ...m, role: "editor" as const }));
  return [...own, ...extras].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function refreshSharedIndexes(id: string): Promise<void> {
  const share = await getShare(id);
  if (!share) return;
  const presentation = await getPresentation(share.ownerId, id);
  if (!presentation) return;
  const meta: PresentationMeta = {
    ...toMeta(presentation),
    role: "editor",
    ownerName: share.ownerName,
  };
  for (const c of share.collaborators.filter((c) => c.status === "accepted")) {
    await upsertSharedIndex(c.userId, meta);
  }
}

export async function listCollaborators(id: string): Promise<{
  owner: { userId: string; email: string; name: string };
  collaborators: Collaborator[];
} | null> {
  const share = await getShare(id);
  if (!share) return null;
  return {
    owner: { userId: share.ownerId, email: share.ownerEmail, name: share.ownerName },
    collaborators: share.collaborators,
  };
}

export async function inviteCollaborator(
  owner: UserProfile,
  presentationId: string,
  email: string
): Promise<Collaborator> {
  const presentation = await getPresentation(owner.userId, presentationId);
  if (!presentation) throw new Error("Presentation not found");

  const target = await findUserByEmail(email);
  if (!target) {
    throw new Error("No present@karm account uses that email. Ask them to sign up first.");
  }
  if (target.userId === owner.userId) throw new Error("You already own this presentation.");

  let share = await getShare(presentationId);
  if (!share) {
    share = {
      presentationId,
      ownerId: owner.userId,
      ownerEmail: owner.email,
      ownerName: owner.name,
      collaborators: [],
    };
  }

  const existing = share.collaborators.find((c) => c.userId === target.userId);
  if (existing?.status === "accepted") throw new Error("That person is already a collaborator.");
  if (existing?.status === "pending") throw new Error("An invite is already waiting for them.");

  const collaborator: Collaborator = {
    userId: target.userId,
    email: target.email,
    name: target.name,
    role: "editor",
    status: "pending",
    invitedAt: new Date().toISOString(),
  };
  share.collaborators = [...share.collaborators.filter((c) => c.userId !== target.userId), collaborator];
  await writeShare(share);

  await pushNotification(target.userId, {
    id: nanoid(10),
    type: "invite",
    createdAt: new Date().toISOString(),
    read: false,
    presentationId,
    presentationTitle: presentation.title,
    from: { userId: owner.userId, name: owner.name, email: owner.email },
    inviteStatus: "pending",
  });

  return collaborator;
}

export async function respondToInvite(
  user: UserProfile,
  notificationId: string,
  accept: boolean
): Promise<AppNotification[]> {
  const inbox = await getInbox(user.userId);
  const note = inbox.find((n) => n.id === notificationId && n.type === "invite");
  if (!note) throw new Error("Invite not found");

  const share = await getShare(note.presentationId);
  if (!share) throw new Error("This invite is no longer valid.");

  const nextStatus: InviteStatus = accept ? "accepted" : "declined";
  share.collaborators = share.collaborators.map((c) =>
    c.userId === user.userId ? { ...c, status: nextStatus } : c
  );
  if (!accept) {
    share.collaborators = share.collaborators.filter((c) => c.userId !== user.userId);
  }
  await writeShare(share);

  if (accept) {
    const presentation = await getPresentation(share.ownerId, note.presentationId);
    if (presentation) {
      await upsertSharedIndex(user.userId, {
        ...toMeta(presentation),
        role: "editor",
        ownerName: share.ownerName,
      });
    }
  } else {
    await removeFromSharedIndex(user.userId, note.presentationId);
  }

  await pushNotification(share.ownerId, {
    id: nanoid(10),
    type: accept ? "invite-accepted" : "invite-declined",
    createdAt: new Date().toISOString(),
    read: false,
    presentationId: note.presentationId,
    presentationTitle: note.presentationTitle,
    from: { userId: user.userId, name: user.name, email: user.email },
  });

  const updated = inbox.map((n) =>
    n.id === notificationId ? { ...n, read: true, inviteStatus: nextStatus } : n
  );
  await writeInbox(user.userId, updated);
  return updated;
}

export async function removeCollaborator(
  ownerId: string,
  presentationId: string,
  collaboratorId: string
): Promise<void> {
  const share = await getShare(presentationId);
  if (!share || share.ownerId !== ownerId) throw new Error("Not found");
  share.collaborators = share.collaborators.filter((c) => c.userId !== collaboratorId);
  await writeShare(share);
  await removeFromSharedIndex(collaboratorId, presentationId);
}

export async function leavePresentation(userId: string, presentationId: string): Promise<void> {
  const share = await getShare(presentationId);
  if (!share) return;
  share.collaborators = share.collaborators.filter((c) => c.userId !== userId);
  await writeShare(share);
  await removeFromSharedIndex(userId, presentationId);
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  return getInbox(userId);
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<AppNotification[]> {
  const inbox = await getInbox(userId);
  const updated = inbox.map((n) =>
    !ids || ids.includes(n.id) ? { ...n, read: true } : n
  );
  await writeInbox(userId, updated);
  return updated;
}

export async function cleanupShare(id: string): Promise<void> {
  const share = await getShare(id);
  if (share) {
    for (const c of share.collaborators) {
      await removeFromSharedIndex(c.userId, id);
    }
  }
  await remove([sharePath(id)]);
}

export async function deleteAccountData(userId: string, email: string): Promise<void> {
  const metas = await listPresentations(userId);
  const supabase = createAdminClient();
  const paths = [
    `${userId}/index.json`,
    `${userId}/inbox.json`,
    `${userId}/shared.json`,
  ];
  if (email) {
    try {
      paths.push(directoryPath(email));
    } catch {
      /* ignore */
    }
  }
  for (const meta of metas) {
    paths.push(`${userId}/${meta.id}.json`, `public/${meta.id}.json`, sharePath(meta.id));
    await cleanupShare(meta.id);
  }
  const shared = await getSharedIndex(userId);
  for (const meta of shared) {
    try {
      await leavePresentation(userId, meta.id);
    } catch {
      /* ignore */
    }
  }
  await supabase.storage.from(PRESENTATIONS_BUCKET).remove(paths);
}
