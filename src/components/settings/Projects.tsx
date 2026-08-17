/** @format */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarRange,
  FolderKanban,
  FolderOpen,
  Save,
  Tags,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Loading from "../ui/Loading";

type Label = {
  name: string;
  color: string;
};

type ProjectsSettings = {
  path?: string;
  requiredFolders?: string[];
  labels?: Label[];
  dateFormat?: string;
};

export default function ProjectsSettings() {
  const [settings, setSettings] = useState<ProjectsSettings>({
    path: "",
    requiredFolders: [],
    labels: [],
    dateFormat: "DDMMYYYY",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newFolder, setNewFolder] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  const [dateParts, setDateParts] = useState(["DD", "MM", "YYYY"]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/settings/projects");

    const data = await res.json();

    const merged: ProjectsSettings = {
      path: "",
      requiredFolders: [],
      labels: [],
      dateFormat: "DDMMYYYY",
      ...data,
    };

    setSettings(merged);

    if (merged.dateFormat) {
      setDateParts(
        ["DD", "MM", "YYYY"].sort(
          (a, b) =>
            merged.dateFormat!.indexOf(a) - merged.dateFormat!.indexOf(b),
        ),
      );
    }

    setLoading(false);
  }

  async function save() {
    setSaving(true);

    await fetch("/api/settings/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...settings,
        dateFormat: dateParts.join(""),
      }),
    });

    setTimeout(() => setSaving(false), 500);
  }

  /* ---------------- Labels ---------------- */

  function addLabel() {
    if (!newLabel.trim()) return;

    setSettings((prev) => ({
      ...prev,
      labels: [
        ...(prev.labels ?? []),
        {
          name: newLabel.trim(),
          color: newColor,
        },
      ],
    }));

    setNewLabel("");
    setNewColor("#6366f1");
  }

  function removeLabel(name: string) {
    setSettings((prev) => ({
      ...prev,
      labels: prev.labels?.filter((label) => label.name !== name) ?? [],
    }));
  }

  function updateLabelColor(name: string, color: string) {
    setSettings((prev) => ({
      ...prev,
      labels:
        prev.labels?.map((label) =>
          label.name === name
            ? {
                ...label,
                color,
              }
            : label,
        ) ?? [],
    }));
  }

  /* ---------------- Folders ---------------- */

  function addFolder() {
    if (!newFolder.trim()) return;

    setSettings((prev) => ({
      ...prev,
      requiredFolders: [...(prev.requiredFolders ?? []), newFolder.trim()],
    }));

    setNewFolder("");
  }

  function removeFolder(folder: string) {
    setSettings((prev) => ({
      ...prev,
      requiredFolders: prev.requiredFolders?.filter((f) => f !== folder) ?? [],
    }));
  }

  /* ---------------- Date Format ---------------- */

  function handleDrop(index: number) {
    if (dragIndex === null) return;

    const next = [...dateParts];

    const [item] = next.splice(dragIndex, 1);

    next.splice(index, 0, item);

    setDateParts(next);

    setDragIndex(null);
  }

  function formatPreview(parts: string[]) {
    const now = new Date();

    const DD = String(now.getDate()).padStart(2, "0");

    const MM = String(now.getMonth() + 1).padStart(2, "0");

    const YYYY = String(now.getFullYear());

    return parts
      .join("")
      .replace("DD", DD)
      .replace("MM", MM)
      .replace("YYYY", YYYY);
  }

  /* ---------------- Loading ---------------- */

  if (loading) return <Loading title="loading..." />;

  /* ---------------- JSX ---------------- */

  return (
    <div className="space-y-8">
      {/* Header */}

      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FolderKanban size={18} className="text-(--accent)" />
          Projects
        </h2>

        <p className="text-sm text-(--text-muted) mt-1">
          Configure project storage, labels and default structure.
        </p>
      </div>

      {/* Storage */}

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
            <FolderOpen size={18} className="text-(--accent)" />
          </div>

          <div>
            <h3 className="font-semibold">Project Storage</h3>

            <p className="text-sm text-(--text-muted)">
              Choose where projects are stored.
            </p>
          </div>
        </div>

        <Input
          label="Projects Folder"
          placeholder="D:\Projects"
          value={settings.path ?? ""}
          onChange={(e) =>
            setSettings({
              ...settings,
              path: e.target.value,
            })
          }
        />

        <div className="flex justify-end">
          <Button icon={<Save size={16} />} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </Card>

      {/* Labels */}

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
            <Tags size={18} className="text-(--accent)" />
          </div>

          <div>
            <h3 className="font-semibold">Project Labels</h3>

            <p className="text-sm text-(--text-muted)">
              Default labels available on projects.
            </p>
          </div>
        </div>

        {settings.labels?.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            <AnimatePresence>
              {settings.labels.map((label) => (
                <motion.div
                  key={label.name}
                  layout
                  initial={{
                    opacity: 0,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                  }}
                >
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={label.color}
                          onChange={(e) =>
                            updateLabelColor(label.name, e.target.value)
                          }
                          className="w-8 h-8 rounded-full"
                        />

                        <span className="font-medium">{label.name}</span>
                      </div>

                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        onClick={() => removeLabel(label.name)}
                      />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={<Tags size={24} />}
            title="No labels"
            description="Create your first project label."
          />
        )}

        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <Input
            placeholder="New label"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />

          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-12 h-11 rounded-full"
          />

          <Button onClick={addLabel}>Add</Button>
        </div>

        <div className="flex justify-end">
          <Button icon={<Save size={16} />} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </Card>

      {/* Required folders */}

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
            <FolderOpen size={18} className="text-(--accent)" />
          </div>

          <div>
            <h3 className="font-semibold">Default Folder Structure</h3>

            <p className="text-sm text-(--text-muted)">
              Folders automatically created for new projects.
            </p>
          </div>
        </div>

        {settings.requiredFolders?.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            <AnimatePresence>
              {settings.requiredFolders.map((folder) => (
                <motion.div
                  key={folder}
                  layout
                  initial={{
                    opacity: 0,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                  }}
                >
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{folder}</span>

                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 size={14} />}
                        onClick={() => removeFolder(folder)}
                      />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={<FolderOpen size={24} />}
            title="No folders"
            description="Create the default folder structure."
          />
        )}

        <div className="flex gap-3">
          <Input
            placeholder="New folder"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
          />

          <Button onClick={addFolder}>Add</Button>
        </div>

        <div className="flex justify-end">
          <Button icon={<Save size={16} />} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </Card>

      {/* Date */}

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
            <CalendarRange size={18} className="text-(--accent)" />
          </div>

          <div>
            <h3 className="font-semibold">Project Naming</h3>

            <p className="text-sm text-(--text-muted)">
              Drag the blocks to define the date format.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {dateParts.map((part, index) => (
            <Card
              key={part}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className="px-5 py-3 cursor-move font-semibold text-center hover:border-(--accent) transition"
            >
              {part}
            </Card>
          ))}
        </div>

        <div className="rounded-xl bg-(--foreground) p-4">
          <div className="text-sm text-(--text-muted)">Preview</div>

          <div className="text-lg font-semibold mt-1">
            {formatPreview(dateParts)}
          </div>
        </div>

        <div className="flex justify-end">
          <Button icon={<Save size={16} />} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
