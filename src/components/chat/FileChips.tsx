"use client";

import {
  AlertCircle,
  Check,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Presentation as PresIcon,
  X,
} from "lucide-react";
import { formatFileSize, type PendingFile } from "@/lib/use-attachments";

function kindIcon(name: string) {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return ImageIcon;
  if ([".csv", ".tsv", ".json"].includes(ext)) return FileSpreadsheet;
  if (ext === ".pptx") return PresIcon;
  if ([".pdf", ".docx", ".txt", ".md"].includes(ext)) return FileText;
  return FileIcon;
}

export function FileChips({
  files,
  onRemove,
  compact,
}: {
  files: PendingFile[];
  onRemove: (id: string) => void;
  compact?: boolean;
}) {
  if (files.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "px-3 pt-2.5" : "px-4 pt-3.5"}`}>
      {files.map((f) => {
        const Icon = kindIcon(f.name);
        return (
          <div
            key={f.id}
            className={`group relative flex items-center gap-2 rounded-xl border pl-2 pr-7 py-1.5 text-[12.5px] overflow-hidden ${
              f.status === "error" ? "border-danger/50 bg-danger/5" : "border-border bg-surface-2"
            }`}
          >
            {f.status === "uploading" && (
              <div
                className="absolute inset-y-0 left-0 bg-accent/10 transition-all duration-200"
                style={{ width: `${f.progress}%` }}
              />
            )}
            {f.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.previewUrl} alt="" className="w-7 h-7 rounded-md object-cover relative" />
            ) : (
              <div className="w-7 h-7 rounded-md bg-surface-3 flex items-center justify-center relative">
                <Icon size={13} className="text-text-secondary" />
              </div>
            )}
            <div className="relative min-w-0">
              <div className="font-medium truncate max-w-[160px]">{f.name}</div>
              <div className="text-[10.5px] text-text-tertiary flex items-center gap-1">
                {f.status === "uploading" && `Uploading ${f.progress}%`}
                {f.status === "done" && (
                  <>
                    <Check size={10} className="text-success" /> {formatFileSize(f.size)}
                  </>
                )}
                {f.status === "error" && (
                  <span className="text-danger flex items-center gap-1">
                    <AlertCircle size={10} /> {f.error}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => onRemove(f.id)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-text hover:bg-surface-3 transition-colors cursor-pointer"
              aria-label={`Remove ${f.name}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
