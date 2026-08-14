import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getPresentation } from "@/lib/store";
import { EditorShell } from "@/components/editor/EditorShell";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const presentation = await getPresentation(user.id, id);
  if (!presentation) notFound();

  return <EditorShell initial={presentation} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const presentation = user ? await getPresentation(user.id, id) : null;
  return { title: presentation ? `${presentation.title} — present@karm` : "Editor — present@karm" };
}
