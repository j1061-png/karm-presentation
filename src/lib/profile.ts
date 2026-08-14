import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export function profileFromUser(user: User): UserProfile {
  const email = user.email ?? "";
  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email.split("@")[0] ??
    "Someone";
  return {
    userId: user.id,
    email,
    name,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}
