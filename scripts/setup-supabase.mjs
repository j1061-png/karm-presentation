/**
 * One-time Supabase setup: creates the storage buckets used by present@karm.
 *   - "presentations" (private): structured presentation JSON per user
 *   - "uploads" (public): user-uploaded images referenced by slides
 *
 * Run with: npm run setup
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false } });

async function ensureBucket(name, isPublic) {
  const { data } = await supabase.storage.getBucket(name);
  if (data) {
    console.log(`Bucket "${name}" already exists.`);
    return;
  }
  const { error } = await supabase.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: isPublic ? "15MB" : "25MB",
  });
  if (error) throw new Error(`Failed to create bucket "${name}": ${error.message}`);
  console.log(`Created bucket "${name}" (${isPublic ? "public" : "private"}).`);
}

await ensureBucket("presentations", false);
await ensureBucket("uploads", true);
console.log("Supabase setup complete.");
