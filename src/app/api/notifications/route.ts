import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { profileFromUser } from "@/lib/profile";
import {
  listNotifications,
  markNotificationsRead,
  registerDirectory,
  respondToInvite,
} from "@/lib/collab";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await registerDirectory(profileFromUser(user));
  const notifications = await listNotifications(user.id);
  return NextResponse.json({ notifications });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const profile = profileFromUser(user);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    if (body.action === "read") {
      const notifications = await markNotificationsRead(
        user.id,
        Array.isArray(body.ids) ? body.ids : undefined
      );
      return NextResponse.json({ notifications });
    }
    if (body.action === "accept" || body.action === "decline") {
      if (typeof body.id !== "string") {
        return NextResponse.json({ error: "Missing invite id" }, { status: 400 });
      }
      const notifications = await respondToInvite(profile, body.id, body.action === "accept");
      return NextResponse.json({ notifications });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 400 }
    );
  }
}
