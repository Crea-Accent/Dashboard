/** @format */
"use client";

import { ClipboardList, FolderTree, Save } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Toggle from "@/components/ui/Toggle";
import { motion } from "framer-motion";

type ProceduresSettings = {
  path?: string;
  includeSubfolders?: boolean;
  watchChanges?: boolean;
  allowPdf?: boolean;
};

export default function ProceduresSettings() {
  const [settings, setSettings] = useState<ProceduresSettings>({
    path: "",
    includeSubfolders: true,
    watchChanges: false,
    allowPdf: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/settings/procedures");
      const data = await res.json();

      setSettings({
        path: "",
        includeSubfolders: true,
        watchChanges: false,
        allowPdf: true,
        ...data,
      });

      setLoading(false);
    }

    load();
  }, []);

  async function save() {
    setSaving(true);

    await fetch("/api/settings/procedures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    setTimeout(() => setSaving(false), 500);
  }

  if (loading) {
    return <div className="text-sm text-(--text-muted)">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}

      <div>
        <h2 className="text-lg font-semibold">Procedures</h2>

        <p className="text-sm text-(--text-muted) mt-1">
          Manage where installation procedures are stored and how they are
          discovered.
        </p>
      </div>

      {/* Storage */}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
              <ClipboardList size={18} className="text-(--accent)" />
            </div>

            <div>
              <h3 className="font-semibold">Procedure Library</h3>

              <p className="text-sm text-(--text-muted)">
                Choose where procedure files are stored.
              </p>
            </div>
          </div>

          <Input
            label="Root Folder"
            placeholder="D:\Procedures"
            value={settings.path ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                path: e.target.value,
              })
            }
          />

          <p className="text-sm text-(--text-muted)">
            All Markdown, PDF and other supported procedure files will be loaded
            from this directory.
          </p>

          <div className="flex justify-end">
            <Button icon={<Save size={16} />} loading={saving} onClick={save}>
              Save Changes
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Behaviour */}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2 }}
      >
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-(--active-accent) flex items-center justify-center">
              <FolderTree size={18} className="text-(--accent)" />
            </div>

            <div>
              <h3 className="font-semibold">Library Behaviour</h3>

              <p className="text-sm text-(--text-muted)">
                Control how procedures are discovered.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <Toggle
              label="Include subfolders"
              description="Recursively scan all nested folders."
              checked={settings.includeSubfolders ?? false}
              onChange={(checked) =>
                setSettings({
                  ...settings,
                  includeSubfolders: checked,
                })
              }
            />

            <Toggle
              label="Watch for file changes"
              description="Automatically reload procedures when files change."
              checked={settings.watchChanges ?? false}
              onChange={(checked) =>
                setSettings({
                  ...settings,
                  watchChanges: checked,
                })
              }
            />

            <Toggle
              label="Allow PDF procedures"
              description="Include PDF documents alongside Markdown procedures."
              checked={settings.allowPdf ?? false}
              onChange={(checked) =>
                setSettings({
                  ...settings,
                  allowPdf: checked,
                })
              }
            />
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
