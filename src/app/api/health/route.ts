import { NextResponse } from "next/server";

/**
 * Public health check used by hosts and by middleware (unauthenticated).
 * Reports whether AI and storage secrets are present — never the values.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ai: Boolean(process.env.DEEPSEEK_API_KEY),
    storage: Boolean(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
