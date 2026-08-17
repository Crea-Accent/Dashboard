/** @format */
"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Selector from "@/components/ui/Selector";
import { useSession } from "next-auth/react";
import { useUpload } from "@/providers/UploadProvider";

type CompleteTaskModalProps = {
  open: boolean;
  client: string;
  poiId: string;
  requiresPicture?: boolean;
  users?: any[];
  ticketId: string;
  onClose: () => void;
  onComplete: (
    finishedImagePath?: string,
    completedBy?: string,
    proofDescription?: string,
  ) => Promise<void>;
};

export default function CompleteTaskModal({
  open,
  client,
  poiId,
  requiresPicture,
  users = [],
  ticketId,
  onClose,
  onComplete,
}: CompleteTaskModalProps) {
  const { data: session } = useSession();
  const { uploadFile, uploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUsername = session?.user?.name || "Unknown User";

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [completedBy, setCompletedBy] = useState<string>(currentUsername);
  const [proofDescription, setProofDescription] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setFilePreview(URL.createObjectURL(f));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let imagePath = undefined;

      if (file) {
        const filename = `${poiId}_proof_${file.name.replace(/\s+/g, "_")}`;
        const savedAs = await uploadFile(
          file,
          client,
          `tickets/${ticketId}` as any,
          { name: filename },
        );
        imagePath = savedAs || undefined;
      }

      await onComplete(imagePath, completedBy, proofDescription);

      // Reset state on successful completion
      setFile(null);
      setFilePreview(null);
      setProofDescription("");
      onClose();
    } catch (error) {
      console.error("Failed to complete task", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setFilePreview(null);
    setProofDescription("");
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Complete Task"
      size="md"
      onClose={handleClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={saving || uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || uploading || (requiresPicture && !file)}
          >
            {saving || uploading ? "Saving..." : "Mark as Done"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-(--text-muted) mb-4">
          You are about to mark this task as completed.{" "}
          {requiresPicture
            ? "Proof media is required for this task."
            : "You can optionally attach media as proof of work."}
        </p>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <div className="flex items-center gap-4 pt-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ImageIcon size={16} />}
            onClick={() => fileInputRef.current?.click()}
          >
            {file ? "Change Photo" : "Take / Upload Proof Photo"}
          </Button>

          {filePreview && (
            <div className="relative">
              <img
                src={filePreview}
                alt="Preview"
                className="h-16 w-16 object-cover rounded-lg border border-(--border)/10"
              />
              <button
                onClick={() => {
                  setFile(null);
                  setFilePreview(null);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Additional Notes
          </label>
          <textarea
            value={proofDescription}
            onChange={(e) => setProofDescription(e.target.value)}
            placeholder="Add any extra details, measurements, or comments here..."
            className="w-full h-24 bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
          />
        </div>
      </div>
    </Modal>
  );
}
