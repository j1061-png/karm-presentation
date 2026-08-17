import { getUser } from "@/lib/supabase/server";
import { generatePresentation, type GenerationStage, type SourceFile } from "@/lib/generate";
import { savePresentation } from "@/lib/store";
import { publicAiError } from "@/lib/public-error";

export const maxDuration = 300;

/**
 * Streams generation progress as server-sent events, then persists the
 * finished presentation and emits its id. The AI key stays server-side.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const prompt: string = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const files: SourceFile[] = Array.isArray(body?.files)
    ? body.files
        .filter(
          (f: unknown): f is SourceFile =>
            typeof f === "object" &&
            f !== null &&
            typeof (f as SourceFile).name === "string" &&
            typeof (f as SourceFile).content === "string"
        )
        .slice(0, 8)
    : [];

  if (!prompt && files.length === 0) {
    return Response.json({ error: "Describe your presentation or attach files." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerationStage) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const presentation = await generatePresentation(
          prompt || "A presentation based on the attached source material.",
          files,
          send,
          body?.effort,
          body?.mode
        );
        await savePresentation(user.id, presentation);
        send({ stage: "complete", presentationId: presentation.id });
      } catch (e) {
        send({
          stage: "error",
          message: publicAiError(e),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
