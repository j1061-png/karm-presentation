import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * URL connector: fetches a public web page server-side and returns its
 * readable text so it can be used as a chat/notebook source.
 */

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 60_000;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "169.254.169.254" || host === "metadata.google.internal") return true;
  // IPv4 literals in private/reserved ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  // IPv6 loopback / link-local / unique-local literals.
  if (host.includes(":")) {
    const bare = host.replace(/^\[|\]$/g, "");
    if (bare === "::1" || bare.startsWith("fe80") || bare.startsWith("fc") || bare.startsWith("fd")) return true;
  }
  return false;
}

/** Strip a web page down to readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) URLs are supported." }, { status: 400 });
  }
  if (isBlockedHost(url.hostname)) {
    return NextResponse.json({ error: "That address cannot be fetched." }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StudioBot/1.0; +https://studio.app)",
        Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.8,*/*;q=0.5",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `The page returned ${res.status}.` }, { status: 502 });
    }

    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
        }
      }
      void reader.cancel().catch(() => undefined);
    }
    const bodyText = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.length === 1 ? chunks[0] : Buffer.concat(chunks.map((c) => Buffer.from(c)))
    );

    const contentType = res.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("html") || /^\s*<(!doctype|html)/i.test(bodyText);
    const text = (isHtml ? htmlToText(bodyText) : bodyText).slice(0, MAX_TEXT);
    if (!text.trim()) {
      return NextResponse.json({ error: "No readable text found on that page." }, { status: 422 });
    }

    const titleMatch = bodyText.match(/<title[^>]*>([^<]*)<\/title>/i);
    const name = titleMatch?.[1]?.trim() || url.hostname + url.pathname;

    return NextResponse.json({
      source: { name: name.slice(0, 120), kind: "url", content: `Source URL: ${url.toString()}\n\n${text}` },
    });
  } catch (e) {
    const message =
      e instanceof Error && e.name === "TimeoutError"
        ? "The page took too long to load."
        : "Could not fetch that page.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
