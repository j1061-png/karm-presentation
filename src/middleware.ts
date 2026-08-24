import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/editor", "/presentations", "/api"];
const PUBLIC_API = ["/api/health", "/api/domains/resolve", "/api/domains/webhook"];

interface DomainMapping {
  projectId: string;
  web: boolean;
  entry: string;
}

/** Short-lived per-instance cache so custom-domain hits don't refetch every request. */
const domainCache = new Map<string, { value: DomainMapping | null; expires: number }>();

async function resolveCustomDomain(host: string, origin: string): Promise<DomainMapping | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.value;
  let value: DomainMapping | null = null;
  try {
    const res = await fetch(`${origin}/api/domains/resolve?host=${encodeURIComponent(host)}`, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as Partial<DomainMapping>;
      if (typeof data.projectId === "string") {
        value = {
          projectId: data.projectId,
          web: data.web === true,
          entry: typeof data.entry === "string" ? data.entry : "index.html",
        };
      }
    }
  } catch {
    value = null;
  }
  domainCache.set(host, { value, expires: Date.now() + 60_000 });
  return value;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ------------------------------------------------- custom domain rewrite
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const appHost = process.env.NEXT_PUBLIC_APP_HOST?.toLowerCase() ?? null;
  const isCustomDomain =
    !!appHost &&
    !!host &&
    host !== appHost &&
    host !== `www.${appHost}` &&
    host !== "localhost" &&
    !host.endsWith(".localhost") &&
    !host.endsWith(".vercel.app") &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(host);

  if (isCustomDomain && !path.startsWith("/api/") && !path.startsWith("/_next")) {
    const mapping = await resolveCustomDomain(host, request.nextUrl.origin);
    if (mapping) {
      const url = request.nextUrl.clone();
      url.pathname = mapping.web
        ? `/p/${mapping.projectId}/${path === "/" ? mapping.entry : path.replace(/^\//, "")}`
        : `/p/${mapping.projectId}`;
      return NextResponse.rewrite(url);
    }
    // Unmapped custom domain: fall through to the normal app.
  }

  // -------------------------------------------------------- public endpoints
  if (PUBLIC_API.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.next({ request });
  }

  // -------------------------------------------------------- Supabase auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected =
    PROTECTED_PREFIXES.some((p) => path.startsWith(p)) &&
    !PUBLIC_API.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    if (path.startsWith("/api")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth|sw.js|manifest.webmanifest|icons/).*)"],
};
