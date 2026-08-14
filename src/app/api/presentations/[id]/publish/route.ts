import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  getPublished,
  publishPresentation,
  setVisibility,
  unpublishPresentation,
  type Visibility,
} from "@/lib/store";
import { getAccessiblePresentation, resolveAccess } from "@/lib/collab";
import { PresentationSchema } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

function parseVisibility(v: unknown): Visibility {
  return v === "private" || v === "public" ? v : "link";
}

/** GET: publish status for the owner. */
export async function GET(_request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const result = await getAccessiblePresentation(user.id, id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const draft = result.presentation;

  const published = await getPublished(id);
  if (!published || published.ownerId !== result.access.ownerId) {
    return NextResponse.json({ published: false });
  }
  return NextResponse.json({
    published: true,
    publishedAt: published.publishedAt,
    visibility: published.visibility,
    hasUnpublishedChanges:
      new Date(draft.updatedAt).getTime() > new Date(published.publishedAt).getTime(),
  });
}

/** POST: publish (or republish) the current draft. */
export async function POST(request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const visibility = parseVisibility(body.visibility);

  const access = await resolveAccess(user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can publish." }, { status: 403 });
  }

  // Validate the draft before it goes live.
  const result = await getAccessiblePresentation(user.id, id);
  const draft = result?.presentation;
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const valid = PresentationSchema.safeParse(draft);
  if (!valid.success) {
    return NextResponse.json(
      { error: "This presentation has invalid content and cannot be published." },
      { status: 422 }
    );
  }

  const published = await publishPresentation(user.id, id, visibility);
  if (!published) return NextResponse.json({ error: "Publish failed" }, { status: 500 });

  return NextResponse.json({
    published: true,
    publishedAt: published.publishedAt,
    visibility: published.visibility,
    hasUnpublishedChanges: false,
  });
}

/** PATCH: change visibility without republishing content. */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const updated = await setVisibility(user.id, id, parseVisibility(body.visibility));
  if (!updated) return NextResponse.json({ error: "Not published" }, { status: 404 });

  return NextResponse.json({
    published: true,
    publishedAt: updated.publishedAt,
    visibility: updated.visibility,
  });
}

/** DELETE: take the presentation offline. */
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const ok = await unpublishPresentation(user.id, id);
  if (!ok) return NextResponse.json({ error: "Not published" }, { status: 404 });
  return NextResponse.json({ published: false });
}
