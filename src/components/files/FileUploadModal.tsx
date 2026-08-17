/** @format */
"use client";

import { Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import MultiSelector from "@/components/ui/MultiSelector";
import Selector from "@/components/ui/Selector";
import { User } from "next-auth";

type Props = {
  files: File[];
  open: boolean;
  groups?: string[];
  initialGroup?: string;
  onClose: () => void;
  onUpload: (
    file: File,
    group: string | undefined,
    name: string,
    comment: string,
    collaborators: string[],
  ) => Promise<void>;
  users: User[];
};

type UploadEntry = {
  file: File;
  name: string;
  group?: string;
  comment: string;
  collaborators: string[];
};

export default function FileUploadModal({
  files,
  open,
  groups = [],
  initialGroup,
  onClose,
  onUpload,
  users,
}: Props) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const collaboratorOptions = users.map((user) => {
    const initials = user.name
      ?.split(" ")
      ?.filter(Boolean)
      ?.map((part) => part[0])
      .join("")
      .toUpperCase();

    return {
      label: `${user.name} (${initials})`,
      value: initials,
    };
  });

  const updateEntry = (index: number, patch: Partial<UploadEntry>) => {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;

        return {
          ...entry,
          ...patch,
        };
      }),
    );
  };

  const uploadAll = async () => {
    try {
      setUploading(true);

      for (const entry of entries) {
        await onUpload(
          entry.file,
          entry.group,
          entry.name,
          entry.comment,
          entry.collaborators,
        );
      }

      onClose();
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    setEntries(
      files.map((file) => ({
        file,
        name: file.name.includes("__")
          ? file.name
              .replace(/\.[^.]+$/, "")
              .split("__")
              .slice(0, -2)
              .join(" ")
          : file.name.replace(/\.[^.]+$/, ""),
        group: initialGroup,
        comment: "",
        collaborators: [],
      })),
    );
  }, [files, open, initialGroup]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold">Upload Files</h2>

            <p className="text-sm text-zinc-500">
              {files.length} file(s) selected
            </p>
          </div>

          <Button variant="ghost" icon={<X size={16} />} onClick={onClose} />
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {entries.map((entry, index) => (
            <div key={`${entry.file.name}-${index}`} className="p-4 space-y-4">
              <div>
                <div className="font-medium truncate">{entry.file.name}</div>

                <div className="text-xs text-zinc-500 mt-1">
                  {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>

              <div
                className={`grid gap-4 ${groups.length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
              >
                <Input
                  label="Display Name"
                  value={entry.name}
                  onChange={(e: any) =>
                    updateEntry(index, {
                      name: e.target.value,
                    })
                  }
                />

                {groups.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Destination Group
                    </label>
                    <Selector
                      value={entry.group || "Ungrouped"}
                      options={[
                        { label: "None (Ungrouped)", value: "Ungrouped" },
                        ...groups
                          .filter((g) => g !== "Ungrouped")
                          .map((g) => ({ label: g, value: g })),
                      ]}
                      onChange={(val) =>
                        updateEntry(index, {
                          group: val,
                        })
                      }
                    />
                  </div>
                )}

                <MultiSelector
                  label={"Collaborators"}
                  value={entry.collaborators}
                  options={collaboratorOptions as any}
                  onChange={(collaborators) =>
                    updateEntry(index, {
                      collaborators,
                    })
                  }
                  placeholder="Collaborators"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Comment
                </label>

                <textarea
                  value={entry.comment}
                  onChange={(e) =>
                    updateEntry(index, {
                      comment: e.target.value,
                    })
                  }
                  rows={3}
                  className="
										w-full
										rounded-xl
										px-3
										py-2
										text-sm
										bg-transparent
										border
										border-zinc-200
										dark:border-zinc-800
										outline-none
									"
                  placeholder="Optional comment"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>

          <Button
            icon={<Upload size={16} />}
            onClick={uploadAll}
            loading={uploading}
          >
            Upload All
          </Button>
        </div>
      </Card>
    </div>
  );
}
