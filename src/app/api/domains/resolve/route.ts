import { NextResponse } from "next/server";
import { getDomainByHost } from "@/lib/domains";
import { getPublished } from "@/lib/store";
import { isWebKind } from "@/lib/schema";

/**
 * Public mapping lookup used by the middleware to route custom domains.
 * Returns where the hostname should serve from, or 404.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get("host") ?? "";
  let record = await getDomainByHost(host);
  // www.example.com falls back to the apex record.
  if (!record && host.startsWith("www.")) record = await getDomainByHost(host.slice(4));
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const published = await getPublished(record.projectId).catch(() => null);
  const web = published ? isWebKind(published.presentation.kind) : false;
  const entry = published?.presentation.entry ?? "index.html";

  return NextResponse.json(
    { projectId: record.projectId, web, entry },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
