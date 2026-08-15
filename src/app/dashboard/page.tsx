import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const metadata = { title: "KarmSolar" };

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/");

  return (
    <DashboardShell
      user={{
        email: user.email ?? "",
        name:
          (user.user_metadata?.full_name as string) ??
          (user.user_metadata?.name as string) ??
          user.email?.split("@")[0] ??
          "there",
        avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
      }}
    />
  );
}
