import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccessiblePresentation } from "@/lib/collab";
import { isWebKind } from "@/lib/schema";
import { EditorShell } from "@/components/editor/EditorShell";
import { WebProjectShell } from "@/components/editor/WebProjectShell";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/");

  const result = await getAccessiblePresentation(user.id, id);
  if (!result) notFound();

  if (isWebKind(result.presentation.kind)) {
    return <WebProjectShell initial={result.presentation} role={result.access.role} />;
  }
  return <EditorShell initial={result.presentation} role={result.access.role} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const result = user ? await getAccessiblePresentation(user.id, id) : null;
  return { title: result ? result.presentation.title : "Editor" };
}
