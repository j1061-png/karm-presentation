import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getPublished } from "@/lib/store";
import { isWebKind } from "@/lib/schema";
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

  // Web projects are served as real files by the sibling catch-all route.
  if (isWebKind(published.presentation.kind)) {
    redirect(`/p/${id}/${published.presentation.entry}`);
  }

  return <StandalonePlayer presentation={published.presentation} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) return { title: "Studio" };
  const published = await getPublished(id).catch(() => null);
  if (!published || published.visibility === "private") {
    return { title: "Studio", robots: { index: false } };
  }

  const p = published.presentation;
  const title = p.title;
  const description =
    p.description ||
    (isWebKind(p.kind)
      ? `An interactive ${p.kind} built with Studio.`
      : `An interactive presentation with ${p.slides.length} slides.`);

  return {
    title,
    description,
    robots: published.visibility === "public" ? undefined : { index: false },
    openGraph: {
      title,
      description,
      siteName: "Studio",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
