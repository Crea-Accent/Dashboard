/** @format */
"use client";

import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import MultiSelector from "@/components/ui/MultiSelector";
import { User } from "next-auth";

type Props = {
  open: boolean;

  file: {
    name: string;
    path: string;
  } | null;

  users: User[];

  onClose: () => void;

  onSave: (
    name: string,
    comment: string,
    collaborators: string[],
  ) => Promise<void>;
};

export default function FileEditModal({
  file,
  open,
  onClose,
  onSave,
  users,
}: Props) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
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

  const save = async () => {
    try {
      setUploading(true);

      await onSave(name, comment, collaborators);

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
    if (!open || !file) {
      return;
    }

    const extension = file.name.split(".").pop() ?? "";

    const filename = file.name.replace(new RegExp(`\\.${extension}$`), "");

    const parts = filename.split("__");

    setName(parts[0]?.replaceAll("_", " ") ?? "");

    setCollaborators((parts[3] ?? "").split("-").filter(Boolean));

    setComment(parts.slice(4).join("__"));
  }, [file, open]);

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
            <h2 className="text-lg font-semibold">Edit File</h2>

            <p className="text-sm text-zinc-500">{file?.name}</p>
          </div>

          <Button variant="ghost" icon={<X size={16} />} onClick={onClose} />
        </div>

        <div className="overflow-y-auto p-5">
          <div className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 items-center">
              <Input
                label="Display Name"
                value={name}
                onChange={(e: any) => setName(e.target.value)}
              />

              <MultiSelector
                label={"Collaborators"}
                value={collaborators}
                options={collaboratorOptions as any}
                onChange={setCollaborators}
                placeholder="Collaborators"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Comment</label>

              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
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
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="secondary" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>

          <Button
            icon={<Save size={16} />}
            onClick={save}
            loading={uploading}
          />
        </div>
      </Card>
    </div>
  );
}
