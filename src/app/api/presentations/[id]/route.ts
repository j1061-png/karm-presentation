import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  deletePresentation,
  getPresentation,
  renamePresentation,
  savePresentation,
} from "@/lib/store";
import { repairPresentation } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const presentation = await getPresentation(user.id, id);
  if (!presentation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ presentation });
}

/** PATCH: full-document save (autosave) or rename. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const existing = await getPresentation(user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (typeof body.title === "string" && !body.presentation) {
    const renamed = await renamePresentation(user.id, id, body.title.trim() || "Untitled presentation");
    return NextResponse.json({ presentation: renamed });
  }

  if (body.presentation) {
    try {
      const doc = repairPresentation(
        { ...body.presentation, id, createdAt: existing.createdAt },
        existing
      );
      await savePresentation(user.id, doc);
      return NextResponse.json({ presentation: doc });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid presentation" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  await deletePresentation(user.id, id);
  return NextResponse.json({ ok: true });
}
