import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getPresentation } from "@/lib/store";
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

  const presentation = await getPresentation(user.id, id);
  if (!presentation) notFound();

  return <StandalonePlayer presentation={presentation} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const presentation = user ? await getPresentation(user.id, id) : null;
  return { title: presentation ? `${presentation.title} — present@karm` : "present@karm" };
}
