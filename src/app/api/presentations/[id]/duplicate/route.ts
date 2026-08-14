import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/supabase/server";
import { duplicatePresentation } from "@/lib/store";
import { resolveAccess } from "@/lib/collab";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const access = await resolveAccess(user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const copy = await duplicatePresentation(access.ownerId, id, user.id, nanoid(12));
  if (!copy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ presentation: copy });
}
