import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccessiblePresentation } from "@/lib/collab";
import { StandalonePlayer } from "./player-client";

/**
 * Standalone presentation website — each presentation lives at its own URL
 * with isolated data, e.g. localhost:3000/presentations/<id>.
 */
export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) notFound();

  const result = await getAccessiblePresentation(user.id, id);
  if (!result) notFound();

  return <StandalonePlayer presentation={result.presentation} canShare isOwner={result.access.role === "owner"} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const result = user ? await getAccessiblePresentation(user.id, id) : null;
  return { title: result ? result.presentation.title : "Studio" };
}
