import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { profileFromUser } from "@/lib/profile";
import {
  inviteCollaborator,
  leavePresentation,
  listCollaborators,
  registerDirectory,
  removeCollaborator,
  resolveAccess,
} from "@/lib/collab";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const access = await resolveAccess(user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const listed = await listCollaborators(id);
  if (listed) return NextResponse.json({ ...listed, role: access.role });

  const profile = profileFromUser(user);
  return NextResponse.json({
    owner: { userId: user.id, email: profile.email, name: profile.name },
    collaborators: [],
    role: access.role,
  });
}

export async function POST(request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await registerDirectory(profileFromUser(user));
  const { id } = await params;
  const access = await resolveAccess(user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can add people." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ error: "Enter an email address." }, { status: 400 });

  try {
    const collaborator = await inviteCollaborator(profileFromUser(user), id, email);
    const listed = await listCollaborators(id);
    return NextResponse.json({ collaborator, role: "owner", ...(listed ?? {}) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send invite" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const access = await resolveAccess(user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const collaboratorId = typeof body?.userId === "string" ? body.userId : "";

  try {
    if (access.role === "editor" && (!collaboratorId || collaboratorId === user.id)) {
      await leavePresentation(user.id, id);
      return NextResponse.json({ ok: true });
    }
    if (access.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can remove people." }, { status: 403 });
    }
    if (!collaboratorId) return NextResponse.json({ error: "Missing user" }, { status: 400 });
    await removeCollaborator(user.id, id, collaboratorId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update collaborators" },
      { status: 400 }
    );
  }
}
