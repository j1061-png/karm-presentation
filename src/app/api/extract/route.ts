import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ACCEPTED_EXTENSIONS, extractContent, fileKind, MAX_FILE_BYTES } from "@/lib/extract";
import { uploadImage } from "@/lib/store";

export const maxDuration = 120;

/**
 * Accepts one uploaded file (multipart form), validates it, extracts text
 * content for AI grounding. Images are stored in Supabase and returned as a URL.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type "${ext}". Supported: ${ACCEPTED_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 20 MB)." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();

  try {
    if (fileKind(file.name) === "image") {
      const url = await uploadImage(user.id, file.name, bytes, file.type || "image/png");
      return NextResponse.json({
        file: {
          name: file.name,
          kind: "image",
          content: `(User-provided image available at URL: ${url} — use it in an "image" element where relevant.)`,
          imageUrl: url,
        },
      });
    }
    const extracted = await extractContent(file.name, bytes);
    return NextResponse.json({ file: extracted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to process file" },
      { status: 422 }
    );
  }
}
