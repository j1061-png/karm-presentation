/**
 * Removes throwaway QA accounts (…@presentkarm.test) plus their storage,
 * left behind if a test run crashed before its own cleanup.
 */
import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of data.users) {
    if (!u.email || !u.email.endsWith("@presentkarm.test")) continue;
    const { data: files } = await admin.storage.from("presentations").list(`users/${u.id}/docs`);
    const paths = (files ?? []).map((f) => `users/${u.id}/docs/${f.name}`);
    for (const f of files ?? []) paths.push(`public/${f.name}`);
    paths.push(`users/${u.id}/index.json`);
    await admin.storage.from("presentations").remove(paths);
    await admin.auth.admin.deleteUser(u.id);
    console.log("removed", u.email);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
