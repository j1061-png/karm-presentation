import type { ProjectFile } from "./schema";
import { repairFiles } from "./validate";

/**
 * Manus agent integration: builds websites, games, and apps through the
 * Manus v2 task API with structured output. Used when MANUS_API_KEY is set;
 * generation falls back to the standard model pipeline on any failure.
 */

const MANUS_BASE = "https://api.manus.ai";

export function manusConfigured(): boolean {
  return !!process.env.MANUS_API_KEY;
}

function headers() {
  const key = process.env.MANUS_API_KEY;
  if (!key) throw new Error("Manus is not configured.");
  return { "Content-Type": "application/json", "x-manus-api-key": key };
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "description", "files"],
  additionalProperties: false,
} as const;

interface ManusEvent {
  type?: string;
  status_update?: { agent_status?: string; brief?: string; description?: string };
  structured_output_result?: { success?: boolean; value?: unknown; error?: string | null };
  error_message?: { content?: string };
}

export interface ManusWebResult {
  title: string;
  description: string;
  files: ProjectFile[];
}

export async function createManusWebTask(
  prompt: string,
  kind: "website" | "game" | "app",
  sourceContext: string
): Promise<string> {
  const brief = `Build a self-contained ${kind} as static web files (single index.html strongly preferred, inline CSS and JS, no external requests except Google Fonts, no build step, no frameworks). It must work offline when opened directly in a browser.

${kind === "game" ? "The game must be fully playable: on-screen instructions, controls, score or win/lose state, and a restart button." : ""}${kind === "app" ? "Every control must work: live state updates, localStorage persistence where sensible, input validation, empty states." : ""}${kind === "website" ? "Real copy (no lorem ipsum), responsive layout, polished typography and spacing." : ""}

USER REQUEST: ${prompt}${sourceContext}

Deliver the final file contents in the structured output: title, one-sentence description, and the complete files array.`;

  const res = await fetch(`${MANUS_BASE}/v2/task.create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      message: { content: brief.slice(0, 18000) },
      hide_in_task_list: true,
      agent_profile: "manus-1.6-lite",
      title: `Studio: ${prompt.slice(0, 60)}`,
      structured_output_schema: OUTPUT_SCHEMA,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    task_id?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.ok || !data.task_id) {
    throw new Error(data.error?.message ?? `Manus task creation failed (${res.status}).`);
  }
  return data.task_id;
}

/** Poll a Manus task until it stops, then extract the structured web result. */
export async function pollManusWebResult(
  taskId: string,
  onDetail: (detail: string) => void,
  deadlineMs: number
): Promise<ManusWebResult> {
  const start = Date.now();
  let lastBrief = "";

  while (Date.now() - start < deadlineMs) {
    await new Promise((r) => setTimeout(r, 5000));

    const res = await fetch(
      `${MANUS_BASE}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=50`,
      { headers: headers() }
    );
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: ManusEvent[] };
    if (!res.ok || !data.ok) continue; // transient poll failure — try again

    const events = data.data ?? [];

    const output = events.find((e) => e.type === "structured_output_result");
    if (output?.structured_output_result) {
      const result = output.structured_output_result;
      if (result.success === false) {
        throw new Error(result.error ?? "The agent could not produce the project.");
      }
      const value = (result.value ?? {}) as { title?: string; description?: string; files?: unknown };
      const files = repairFiles(value.files);
      if (files.length === 0 || !files.some((f) => f.content.length > 200)) {
        throw new Error("The agent returned no usable files.");
      }
      return {
        title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : "Untitled project",
        description: typeof value.description === "string" ? value.description : "",
        files,
      };
    }

    const status = events.find((e) => e.type === "status_update")?.status_update;
    if (status?.agent_status === "error") {
      const err = events.find((e) => e.type === "error_message")?.error_message?.content;
      throw new Error(err ?? "The agent hit an error while building.");
    }
    if (status?.agent_status === "waiting") {
      throw new Error("The agent paused for confirmation, which is not supported here.");
    }
    // "stopped" without structured output yet: extraction runs after stop, keep polling.

    const brief = status?.brief ?? "";
    if (brief && brief !== lastBrief) {
      lastBrief = brief;
      onDetail(brief);
    }
  }

  throw new Error("The agent is taking too long. Try again, or use a simpler request.");
}
