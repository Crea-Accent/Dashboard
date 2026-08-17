/** @format */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useContext, useState } from "react";

type Toast =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;
type UploadMetadata = {
  name?: string;
  comment?: string;
  collaborators?: string[];
};
type UploadContextType = {
  uploading: boolean;
  progress: number;

  uploadFile: (
    file: File,
    client: string,
    kind: "picture" | "schema" | "programmation" | "documents" | "tickets",
    metadata?: UploadMetadata,
  ) => Promise<string | null>;
};

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<Toast>(null);

  async function uploadFile(
    file: File,
    client: string,
    kind: "picture" | "schema" | "programmation" | "documents" | "tickets",
    metadata?: UploadMetadata,
  ): Promise<string | null> {
    setUploading(true);
    setProgress(0);

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/files/upload");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        setUploading(false);

        if (xhr.status >= 200 && xhr.status < 300) {
          setToast({
            type: "success",
            message: `${file.name} uploaded successfully.`,
          });
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res.savedAs || null);
          } catch {
            resolve(null);
          }
        } else {
          setToast({
            type: "error",
            message: "Upload failed.",
          });
          resolve(null);
        }

        autoClear();
      };

      xhr.onerror = () => {
        setUploading(false);
        setToast({
          type: "error",
          message: "Upload failed.",
        });
        autoClear();
        resolve(null);
      };

      const formData = new FormData();

      formData.append("file", file);
      formData.append("client", encodeURIComponent(client));
      formData.append("kind", kind);

      if (metadata?.name) {
        formData.append("name", metadata.name);
      }

      if (metadata?.comment) {
        formData.append("comment", metadata.comment);
      }

      for (const collaborator of metadata?.collaborators ?? []) {
        formData.append("collaborators", collaborator);
      }

      xhr.send(formData);
    });
  }

  function autoClear() {
    setTimeout(() => {
      setToast(null);
      setProgress(0);
    }, 3000);
  }

  return (
    <UploadContext.Provider
      value={{
        uploading,
        progress,
        uploadFile,
      }}
    >
      {children}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed top-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-0 left-0 w-full h-1 bg-zinc-200 z-50"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-500"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside UploadProvider");
  return ctx;
}
