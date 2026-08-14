import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getPublished } from "@/lib/store";
import { StandalonePlayer } from "@/app/presentations/[id]/player-client";

/**
 * Public presentation URL: /p/<presentation-id>
 *
 * One deployed app serves every published presentation dynamically from the
 * published snapshot in Supabase. Visibility rules:
 *   - "link" / "public": anyone with the URL can view
 *   - "private": only the owner (requires session)
 */

export const dynamic = "force-dynamic";

async function loadViewable(id: string) {
  const published = await getPublished(id).catch(() => null);
  if (!published) return null;
  if (published.visibility === "private") {
    const user = await getUser();
    if (!user || user.id !== published.ownerId) return null;
  }
  return published;
}

export default async function PublicPresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) notFound();
  const published = await loadViewable(id);
  if (!published) notFound();

  return <StandalonePlayer presentation={published.presentation} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) return { title: "present@karm" };
  const published = await getPublished(id).catch(() => null);
  if (!published || published.visibility === "private") {
    return { title: "present@karm", robots: { index: false } };
  }

  const p = published.presentation;
  const title = p.title;
  const description =
    p.description || `An interactive presentation with ${p.slides.length} slides — made with present@karm.`;

  return {
    title: `${title} — present@karm`,
    description,
    robots: published.visibility === "public" ? undefined : { index: false },
    openGraph: {
      title,
      description,
      siteName: "present@karm",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
