"use client";

import { useCallback, useRef, useState } from "react";
import { extractFile, type UploadedSource } from "@/lib/api";

export const ATTACH_ACCEPT =
  ".pdf,.docx,.pptx,.csv,.tsv,.txt,.md,.json,.png,.jpg,.jpeg,.gif,.webp,.html,.htm";

export interface PendingFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  source?: UploadedSource;
  previewUrl?: string;
}

export function useAttachments(max = 8) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming).slice(0, max);
      for (const file of list) {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const isImage = file.type.startsWith("image/");
        const entry: PendingFile = {
          id,
          name: file.name,
          size: file.size,
          status: "uploading",
          progress: 0,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
        setFiles((prev) => [...prev, entry]);
        extractFile(file, (pct) =>
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: pct } : f)))
        )
          .then((source) =>
            setFiles((prev) =>
              prev.map((f) => (f.id === id ? { ...f, status: "done", progress: 100, source } : f))
            )
          )
          .catch((e) =>
            setFiles((prev) =>
              prev.map((f) =>
                (f.id === id
                  ? { ...f, status: "error", error: e.message ?? "Upload failed" }
                  : f)
              )
            )
          );
      }
    },
    [max]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearFiles = useCallback(() => setFiles([]), []);

  const readySources = files.filter((f) => f.status === "done" && f.source).map((f) => f.source!);
  const uploading = files.some((f) => f.status === "uploading");

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    readySources,
    uploading,
    inputRef,
  };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
