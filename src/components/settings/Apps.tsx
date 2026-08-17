/** @format */
"use client";

import { HardDrive, Save } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Loading from "@/components/ui/Loading";
import PageHeader from "@/components/ui/PageHeader";

type AppsSettings = {
  path?: string;
};

export default function AppsSettings() {
  const [settings, setSettings] = useState<AppsSettings>({
    path: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings/apps");
      const data = await res.json();

      setSettings({
        path: "",
        ...data,
      });

      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);

    await fetch("/api/settings/apps", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    setSaving(false);
  }

  if (loading) {
    return (
      <Loading title="Apps" description="Loading application settings..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<HardDrive size={20} />}
        title="Apps"
        description="Configure where installer files are discovered."
      />

      <Card className="p-6 space-y-6">
        <Input
          label="Applications Folder"
          placeholder="D:\Installers"
          value={settings.path ?? ""}
          onChange={(e) =>
            setSettings({
              ...settings,
              path: e.target.value,
            })
          }
        />

        <EmptyState
          icon={<HardDrive size={22} />}
          title="Installer Directory"
          description="Executable installers (.exe, .msi and similar files) will be discovered from this folder and made available throughout the application."
        />

        <div className="flex justify-end">
          <Button icon={<Save size={16} />} onClick={save} loading={saving}>
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
