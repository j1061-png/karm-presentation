import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getPresentation } from "@/lib/store";
import {
  deleteDomain,
  domainsConfig,
  getDomainByHost,
  listUserDomains,
  normalizeHostname,
  purchaseConfigured,
  saveDomain,
  vercelAddDomain,
  type DomainRecord,
} from "@/lib/domains";

export const maxDuration = 60;

/** GET: list the caller's domains (optionally for one project). */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  let domains = await listUserDomains(user.id);
  if (projectId) domains = domains.filter((d) => d.projectId === projectId);
  return NextResponse.json({
    domains,
    purchaseConfigured: purchaseConfigured(),
    connectConfigured: true,
    appHost: domainsConfig().appHost,
  });
}

/** POST: connect a domain the user already owns to a project. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const hostname = normalizeHostname(body?.hostname);
  const projectId: string | undefined = body?.projectId;
  if (!hostname || !projectId || !/^[\w-]+$/.test(projectId)) {
    return NextResponse.json({ error: "Enter a valid domain like example.com" }, { status: 400 });
  }

  const project = await getPresentation(user.id, projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const existing = await getDomainByHost(hostname);
  if (existing && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "That domain is already connected by another user." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const record: DomainRecord = {
    hostname,
    projectId,
    ownerId: user.id,
    source: existing?.source ?? "connected",
    status: existing?.status === "active" ? "active" : "pending_dns",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    orderId: existing?.orderId,
    paidCents: existing?.paidCents,
  };

  try {
    await vercelAddDomain(hostname);
  } catch (e) {
    record.status = "error";
    record.error = e instanceof Error ? e.message : "Could not attach the domain.";
  }

  await saveDomain(record);
  return NextResponse.json({
    domain: record,
    dns: {
      type: "CNAME",
      host: hostname,
      value: "cname.vercel-dns.com",
      note: "Point your domain's CNAME (or ALIAS/ANAME for the root) at this value, then give DNS a few minutes.",
    },
  });
}

/** DELETE: disconnect a domain. */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const hostname = normalizeHostname(searchParams.get("hostname"));
  if (!hostname) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  const removed = await deleteDomain(user.id, hostname);
  if (!removed) return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
