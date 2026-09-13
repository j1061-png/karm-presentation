import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getUser } from "@/lib/supabase/server";
import { savePresentation } from "@/lib/store";
import { listAccessiblePresentations, registerDirectory } from "@/lib/collab";
import { profileFromUser } from "@/lib/profile";
import { defaultStudioScene } from "@/lib/model-scene";
import { blankWebFiles } from "@/lib/blank-project";
import { repairPresentation } from "@/lib/validate";
import { isWebKind, type Presentation } from "@/lib/schema";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    await registerDirectory(profileFromUser(user));
    const presentations = await listAccessiblePresentations(user.id);
    return NextResponse.json({ presentations });
  } catch (e) {
    console.error("[presentations]", e);
    return NextResponse.json({ presentations: [] });
  }
}

/** Create a presentation — blank, or from a provided document (templates). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  let presentation: Presentation;
  if (body.presentation) {
    try {
      presentation = repairPresentation({ ...body.presentation, id: nanoid(12) }, {});
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid presentation" },
        { status: 400 }
      );
    }
  } else if (body.kind === "model") {
    presentation = repairPresentation(
      {
        id: nanoid(12),
        title: typeof body.title === "string" && body.title.trim() ? body.title : "Untitled model",
        kind: "model",
        slides: [],
        scene: defaultStudioScene(),
        createdAt: now,
        updatedAt: now,
      },
      {}
    );
  } else if (isWebKind(body.kind)) {
    const files = blankWebFiles(body.kind);
    presentation = repairPresentation(
      {
        id: nanoid(12),
        title:
          typeof body.title === "string" && body.title.trim()
            ? body.title
            : body.kind === "game"
              ? "Untitled game"
              : body.kind === "app"
                ? "Untitled app"
                : "Untitled website",
        kind: body.kind,
        slides: [],
        files,
        entry: "index.html",
        createdAt: now,
        updatedAt: now,
      },
      {}
    );
  } else {
    presentation = repairPresentation(
      {
        id: nanoid(12),
        title: typeof body.title === "string" && body.title.trim() ? body.title : "Untitled presentation",
        kind: "presentation",
        slides: [
          {
            id: nanoid(8),
            name: "Title",
            elements: [
              {
                id: nanoid(8),
                type: "heading",
                x: 8, y: 34, w: 84, h: 16, z: 1,
                props: { text: "Untitled presentation", level: 1 },
                style: { textAlign: "center" },
              },
              {
                id: nanoid(8),
                type: "text",
                x: 20, y: 54, w: 60, h: 8, z: 1,
                props: { text: "Click anywhere to start editing, or ask AI to build this out." },
                style: { textAlign: "center", color: "#9ba1ab" },
              },
            ],
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {}
    );
  }

  await savePresentation(user.id, presentation);
  return NextResponse.json({ presentation });
}
