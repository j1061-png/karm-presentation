import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { checkDomain, getDomainByHost, normalizeHostname, purchaseConfigured } from "@/lib/domains";

export const maxDuration = 30;

/** GET /api/domains/search?q=example.com — availability + price. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!purchaseConfigured()) {
    return NextResponse.json(
      { error: "Domain purchase is not configured yet. You can still connect a domain you already own." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? "";
  // Bare names get .com by default so "mysite" works.
  const withTld = raw.includes(".") ? raw : `${raw}.com`;
  const host = normalizeHostname(withTld);
  if (!host) return NextResponse.json({ error: "Enter a valid domain like example.com" }, { status: 400 });

  try {
    const result = await checkDomain(host);
    const taken = await getDomainByHost(host);
    return NextResponse.json({
      ...result,
      available: result.available && !taken,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Domain search failed." },
      { status: 502 }
    );
  }
}
