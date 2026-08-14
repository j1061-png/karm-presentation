"use client";

import type { Presentation } from "@/lib/schema";
import { Player } from "@/components/present/Player";

export function StandalonePlayer({ presentation }: { presentation: Presentation }) {
  return (
    <div className="fixed inset-0">
      <Player presentation={presentation} embedded />
    </div>
  );
}
