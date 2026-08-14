import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { savePresentation } from "@/lib/store";
import { getAccessiblePresentation, refreshSharedIndexes } from "@/lib/collab";
import { publicAiError } from "@/lib/public-error";
import { applyOperations, generateEdit } from "@/lib/generate";

export const maxDuration = 180;

/**
 * AI editing: modifies the structured model through validated operations.
 * Receives the user's instruction + selection context, asks the AI for
 * operations, applies them server-side, persists, and returns the updated
 * document plus a summary.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const presentationId: string | undefined = body?.presentationId;
  const instruction: string | undefined = body?.instruction?.trim();
  if (!presentationId || !instruction) {
    return NextResponse.json({ error: "Missing presentationId or instruction" }, { status: 400 });
  }

  const result = await getAccessiblePresentation(user.id, presentationId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const presentation = result.presentation;

  // The client sends its current (possibly unsaved) document so edits apply
  // to what the user actually sees.
  const workingDoc = body?.presentation ?? presentation;

  try {
    const response = await generateEdit(
      workingDoc,
      instruction,
      body?.selectedSlideId,
      body?.selectedElementId
    );
    if (response.operations.length === 0) {
      return NextResponse.json({
        summary: response.summary || "I couldn't find anything to change for that request.",
        presentation: workingDoc,
        changed: false,
      });
    }
    const updated = applyOperations(workingDoc, response);
    await savePresentation(result.access.ownerId, updated);
    await refreshSharedIndexes(presentationId);
    return NextResponse.json({ summary: response.summary, presentation: updated, changed: true });
  } catch (e) {
    return NextResponse.json({ error: publicAiError(e) }, { status: 502 });
  }
}
