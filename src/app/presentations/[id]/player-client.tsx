"use client";

import { isWebKind, type Presentation } from "@/lib/schema";
import { Player } from "@/components/present/Player";
import { assemblePreviewHtml } from "@/lib/web-preview";

export function StandalonePlayer({ presentation }: { presentation: Presentation }) {
  if (isWebKind(presentation.kind)) {
    return (
      <iframe
        srcDoc={assemblePreviewHtml(presentation.files, presentation.entry)}
        sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups"
        className="fixed inset-0 w-full h-full border-0 bg-white"
        title={presentation.title}
      />
    );
  }
  return (
    <div className="fixed inset-0">
      <Player presentation={presentation} embedded />
    </div>
  );
}
