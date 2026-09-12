import { NextResponse } from "next/server";
import { storageConfigured } from "@/lib/object-store";

/**
 * Public health check used by hosts and by middleware (unauthenticated).
 * Reports whether AI and storage secrets are present — never the values.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    ai: Boolean(process.env.DEEPSEEK_API_KEY),
    storage: storageConfigured(),
  });
}
