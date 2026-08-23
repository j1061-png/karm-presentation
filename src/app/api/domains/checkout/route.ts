import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getPresentation } from "@/lib/store";
import {
  checkDomain,
  createDomainCheckout,
  getDomainByHost,
  normalizeHostname,
  purchaseConfigured,
} from "@/lib/domains";

export const maxDuration = 60;

/** POST: start a Stripe Checkout for a domain purchase. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!purchaseConfigured()) {
    return NextResponse.json(
      { error: "Domain purchase is not configured yet. You can still connect a domain you already own." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const hostname = normalizeHostname(body?.domain);
  const projectId: string | undefined = body?.projectId;
  if (!hostname || !projectId || !/^[\w-]+$/.test(projectId)) {
    return NextResponse.json({ error: "Invalid domain or project." }, { status: 400 });
  }

  const project = await getPresentation(user.id, projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    // Re-quote live so the charged price always matches the registrar price.
    const quote = await checkDomain(hostname);
    const taken = await getDomainByHost(hostname);
    if (!quote.available || taken || quote.priceCents === null || quote.registrarCents === null) {
      return NextResponse.json({ error: "That domain is no longer available." }, { status: 409 });
    }

    const origin = new URL(request.url).origin;
    const { url } = await createDomainCheckout({
      domain: hostname,
      priceCents: quote.priceCents,
      registrarCents: quote.registrarCents,
      projectId,
      userId: user.id,
      origin,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start checkout." },
      { status: 502 }
    );
  }
}
