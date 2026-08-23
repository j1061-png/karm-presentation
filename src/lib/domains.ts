import { createAdminClient } from "./supabase/admin";
import { PRESENTATIONS_BUCKET } from "./store";

/**
 * Custom domain layer: buy a domain (Stripe checkout → Porkbun registration)
 * or connect one you already own, attach it to the deployment (Vercel), and
 * map the hostname to a published project.
 *
 * Records live in Supabase Storage:
 *   domains/hosts/{hostname}.json  — one record per domain
 *   domains/users/{userId}.json    — hostnames owned by a user
 *
 * All third-party calls degrade with clear errors when keys are missing so
 * the rest of the app keeps working without them.
 */

export interface DomainRecord {
  hostname: string;
  projectId: string;
  ownerId: string;
  source: "purchased" | "connected";
  status: "pending_dns" | "active" | "error";
  createdAt: string;
  updatedAt: string;
  error?: string;
  /** Porkbun order id when purchased through us. */
  orderId?: number;
  /** What the buyer paid, in USD cents. */
  paidCents?: number;
}

/* ------------------------------------------------------------------ */
/* Configuration                                                        */
/* ------------------------------------------------------------------ */

export function domainsConfig() {
  return {
    porkbun: !!(process.env.PORKBUN_API_KEY && process.env.PORKBUN_SECRET_API_KEY),
    stripe: !!process.env.STRIPE_SECRET_KEY,
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    vercel: !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID),
    appHost: process.env.NEXT_PUBLIC_APP_HOST ?? null,
  };
}

/** Can users buy domains end-to-end? */
export function purchaseConfigured(): boolean {
  const c = domainsConfig();
  return c.porkbun && c.stripe && c.stripeWebhook;
}

/* ------------------------------------------------------------------ */
/* Hostname validation                                                  */
/* ------------------------------------------------------------------ */

/** Normalize + validate a hostname like "example.com" or "www.example.com". */
export function normalizeHostname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!host || host.length > 253) return null;
  if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(host)) return null;
  if (host.endsWith(".vercel.app") || host === "localhost") return null;
  return host;
}

/* ------------------------------------------------------------------ */
/* Storage                                                              */
/* ------------------------------------------------------------------ */

function hostPath(hostname: string) {
  // hostnames are already validated; keep the path flat and safe
  return `domains/hosts/${hostname}.json`;
}

function userDomainsPath(userId: string) {
  return `domains/users/${userId}.json`;
}

async function download(path: string): Promise<unknown | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(PRESENTATIONS_BUCKET).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function upload(path: string, body: unknown): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PRESENTATIONS_BUCKET)
    .upload(path, JSON.stringify(body), { contentType: "application/json", upsert: true });
  if (error) throw new Error(`Failed to save domain record: ${error.message}`);
}

export async function getDomainByHost(hostname: string): Promise<DomainRecord | null> {
  const host = normalizeHostname(hostname);
  if (!host) return null;
  const doc = await download(hostPath(host));
  if (!doc || typeof doc !== "object") return null;
  const record = doc as DomainRecord;
  if (typeof record.hostname !== "string" || typeof record.projectId !== "string") return null;
  return record;
}

export async function listUserDomains(userId: string): Promise<DomainRecord[]> {
  const index = await download(userDomainsPath(userId));
  if (!Array.isArray(index)) return [];
  const records = await Promise.all(
    index.filter((h): h is string => typeof h === "string").map((h) => getDomainByHost(h))
  );
  return records.filter((r): r is DomainRecord => r !== null && r.ownerId === userId);
}

export async function saveDomain(record: DomainRecord): Promise<void> {
  await upload(hostPath(record.hostname), record);
  const index = await download(userDomainsPath(record.ownerId));
  const hosts = new Set(Array.isArray(index) ? index.filter((h): h is string => typeof h === "string") : []);
  hosts.add(record.hostname);
  await upload(userDomainsPath(record.ownerId), [...hosts]);
}

export async function deleteDomain(userId: string, hostname: string): Promise<boolean> {
  const record = await getDomainByHost(hostname);
  if (!record || record.ownerId !== userId) return false;
  const supabase = createAdminClient();
  await supabase.storage.from(PRESENTATIONS_BUCKET).remove([hostPath(record.hostname)]);
  const index = await download(userDomainsPath(userId));
  const hosts = (Array.isArray(index) ? index : []).filter(
    (h): h is string => typeof h === "string" && h !== record.hostname
  );
  await upload(userDomainsPath(userId), hosts);
  await vercelRemoveDomain(record.hostname).catch(() => undefined);
  return true;
}

/* ------------------------------------------------------------------ */
/* Porkbun                                                              */
/* ------------------------------------------------------------------ */

const PORKBUN_BASE = "https://api.porkbun.com/api/json/v3";

function porkbunAuth() {
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_API_KEY;
  if (!apikey || !secretapikey) throw new Error("Domain registrar is not configured.");
  return { apikey, secretapikey };
}

async function porkbunPost(path: string, body: Record<string, unknown>, idempotencyKey?: string) {
  const res = await fetch(`${PORKBUN_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ ...porkbunAuth(), ...body }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.status !== "SUCCESS") {
    const message = typeof data.message === "string" ? data.message : `Registrar error (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export interface DomainAvailability {
  domain: string;
  available: boolean;
  /** Registration price for the first year, in USD cents (includes our fee). */
  priceCents: number | null;
  /** Raw registrar price in USD cents (what we pay Porkbun). */
  registrarCents: number | null;
}

/** Flat service fee added on top of the registrar price, in USD cents. */
const SERVICE_FEE_CENTS = 300;

export async function checkDomain(domain: string): Promise<DomainAvailability> {
  const host = normalizeHostname(domain);
  if (!host) throw new Error("That doesn't look like a valid domain name.");
  const data = await porkbunPost(`/domain/checkDomain/${host}`, {});
  const response = (data.response ?? {}) as Record<string, unknown>;
  const available = response.avail === "yes" || response.avail === true;
  const priceRaw = response.price;
  const priceUsd =
    typeof priceRaw === "string" ? parseFloat(priceRaw) : typeof priceRaw === "number" ? priceRaw : NaN;
  const registrarCents = Number.isFinite(priceUsd) ? Math.round(priceUsd * 100) : null;
  return {
    domain: host,
    available,
    registrarCents,
    priceCents: registrarCents !== null ? registrarCents + SERVICE_FEE_CENTS : null,
  };
}

/** Register the domain at Porkbun. `registrarCents` must match the live quote. */
export async function registerDomain(domain: string, registrarCents: number): Promise<number | undefined> {
  const host = normalizeHostname(domain);
  if (!host) throw new Error("Invalid domain.");
  const data = await porkbunPost(
    `/domain/create/${host}`,
    { cost: registrarCents, agreeToTerms: "yes" },
    `studio-${host}`
  );
  const orderId = (data as { orderId?: number }).orderId;
  return typeof orderId === "number" ? orderId : undefined;
}

/** Point the new domain at the deployment: ALIAS on the apex + CNAME on www. */
export async function configureDns(domain: string): Promise<void> {
  const host = normalizeHostname(domain);
  if (!host) throw new Error("Invalid domain.");
  const target = "cname.vercel-dns.com";
  await porkbunPost(`/dns/create/${host}`, { type: "ALIAS", name: "", content: target, ttl: "600" });
  await porkbunPost(`/dns/create/${host}`, { type: "CNAME", name: "www", content: target, ttl: "600" });
}

/* ------------------------------------------------------------------ */
/* Vercel                                                               */
/* ------------------------------------------------------------------ */

function vercelParams() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  const teamId = process.env.VERCEL_TEAM_ID;
  return { token, projectId, query: teamId ? `?teamId=${encodeURIComponent(teamId)}` : "" };
}

/** Attach the hostname to the Vercel project so TLS + routing work. */
export async function vercelAddDomain(hostname: string): Promise<void> {
  const cfg = vercelParams();
  if (!cfg) return; // hosting attach not configured — DNS instructions still shown
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${cfg.projectId}/domains${cfg.query}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: hostname }),
    }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    // Already attached is fine.
    if (data.error?.code === "domain_already_in_use" || res.status === 409) return;
    throw new Error(data.error?.message ?? `Could not attach the domain to hosting (${res.status}).`);
  }
}

export async function vercelRemoveDomain(hostname: string): Promise<void> {
  const cfg = vercelParams();
  if (!cfg) return;
  await fetch(
    `https://api.vercel.com/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(hostname)}${cfg.query}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${cfg.token}` } }
  );
}

/* ------------------------------------------------------------------ */
/* Stripe (REST — no SDK)                                               */
/* ------------------------------------------------------------------ */

export async function createDomainCheckout(input: {
  domain: string;
  priceCents: number;
  registrarCents: number;
  projectId: string;
  userId: string;
  origin: string;
}): Promise<{ url: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Domain billing is not configured.");

  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${input.origin}/dashboard?domain=${encodeURIComponent(input.domain)}&checkout=success`,
    cancel_url: `${input.origin}/dashboard?checkout=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(input.priceCents),
    "line_items[0][price_data][product_data][name]": `Domain ${input.domain} — 1 year`,
    "line_items[0][price_data][product_data][description]":
      "Registration, DNS setup, and connection to your published project.",
    "metadata[domain]": input.domain,
    "metadata[projectId]": input.projectId,
    "metadata[userId]": input.userId,
    "metadata[registrarCents]": String(input.registrarCents),
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (!res.ok || !data.url) {
    throw new Error(data.error?.message ?? "Could not start checkout.");
  }
  return { url: data.url };
}

/** Verify a Stripe webhook signature (t=...,v1=... HMAC-SHA256). */
export async function verifyStripeSignature(payload: string, header: string | null): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=");
      return [k.trim(), rest.join("=")];
    })
  ) as Record<string, string>;
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject events older than 5 minutes to limit replay.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

/* ------------------------------------------------------------------ */
/* Fulfilment — runs from the Stripe webhook after payment              */
/* ------------------------------------------------------------------ */

export async function fulfilDomainPurchase(input: {
  domain: string;
  projectId: string;
  userId: string;
  registrarCents: number;
  paidCents?: number;
}): Promise<DomainRecord> {
  const now = new Date().toISOString();
  const record: DomainRecord = {
    hostname: input.domain,
    projectId: input.projectId,
    ownerId: input.userId,
    source: "purchased",
    status: "pending_dns",
    createdAt: now,
    updatedAt: now,
    paidCents: input.paidCents,
  };

  try {
    record.orderId = await registerDomain(input.domain, input.registrarCents);
    await configureDns(input.domain);
    await vercelAddDomain(input.domain);
    await vercelAddDomain(`www.${input.domain}`).catch(() => undefined);
    record.status = "active";
  } catch (e) {
    record.status = "error";
    record.error = e instanceof Error ? e.message : "Registration failed.";
  }

  record.updatedAt = new Date().toISOString();
  await saveDomain(record);
  return record;
}
