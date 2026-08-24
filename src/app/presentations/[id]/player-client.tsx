"use client";

import { useState } from "react";
import { isWebKind, type Presentation } from "@/lib/schema";
import { Player } from "@/components/present/Player";
import { assemblePreviewHtml } from "@/lib/web-preview";
import { ShareModal } from "@/components/share/ShareModal";
import { ShareButton } from "@/components/share/ShareButton";

export function StandalonePlayer({
  presentation,
  isOwner = true,
  canShare = false,
}: {
  presentation: Presentation;
  isOwner?: boolean;
  canShare?: boolean;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  if (isWebKind(presentation.kind)) {
    return (
      <div className="fixed inset-0">
        <iframe
          srcDoc={assemblePreviewHtml(presentation.files, presentation.entry)}
          sandbox="allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups"
          className="absolute inset-0 w-full h-full border-0 bg-white"
          title={presentation.title}
        />
        {canShare && (
          <div className="absolute top-3 right-3 z-20">
            <ShareButton
              presentationId={presentation.id}
              title={presentation.title}
              isOwner={isOwner}
              variant="accent"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0">
      <Player
        presentation={presentation}
        embedded
        onShare={canShare ? () => setShareOpen(true) : undefined}
      />
      {shareOpen && (
        <ShareModal
          presentationId={presentation.id}
          title={presentation.title}
          onClose={() => setShareOpen(false)}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}
