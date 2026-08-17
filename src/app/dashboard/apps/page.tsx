/** @format */
"use client";

import { Download, DownloadIcon, Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Loading from "@/components/ui/Loading";
import { NotPermitted } from "@/providers/PermissionsProvider";
import PageHeader from "@/components/ui/PageHeader";
import ViewToggle from "@/components/ui/ViewToggle";
import { formatFileSize } from "@/lib/size";
import { useSession } from "next-auth/react";

type FileEntry = {
  path: string;
  name: string;
  type: string;
  size: number;
  accessible?: boolean;
};

type AppsSettings = {
  path?: string;
};

const INSTALLER_EXTENSIONS = [
  ".exe",
  ".msi",
  ".msix",
  ".msixbundle",
  ".appx",
  ".appxbundle",
];

export default function AppsPage() {
  const { data: session } = useSession();

  const [settings, setSettings] = useState<AppsSettings | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">(
    (session?.user?.preferences?.defaultView as "grid" | "list") ?? "grid",
  );

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/settings/apps").then((r) => r.json());
      setSettings(s);

      if (!s.path) {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/files?view=${encodeURIComponent(s.path)}`);
      const data = await res.json();

      if (Array.isArray(data)) {
        setFiles(data);
      } else {
        setFiles([]);
        console.error("Failed to load apps:", data.error);
      }
      setLoading(false);
    })();
  }, []);

  const installers = useMemo(() => {
    return files.filter((f) => {
      if (f.type !== "file") return false;
      const lower = f.name.toLowerCase();
      return INSTALLER_EXTENSIONS.some((ext) => lower.endsWith(ext));
    });
  }, [files]);

  function download(path: string) {
    const url = `/api/files/download?path=${encodeURIComponent(path)}`;
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const filteredInstallers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return installers;

    return installers.filter((file) => file.name.toLowerCase().includes(query));
  }, [installers, search]);

  if (loading) return <Loading title="Loading Installers" />;

  return (
    <NotPermitted permission="applications.read">
      <div className="space-y-6">
        <PageHeader
          icon={<Package size={20} />}
          title="Apps"
          description="Available installer packages"
        />

        {!settings?.path && (
          <EmptyState
            icon={<Package size={24} />}
            title="Apps path not configured"
            description="Configure the applications directory in settings."
          />
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 max-w-md">
            <Input
              icon={<Search size={16} />}
              placeholder="Search installers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ViewToggle value={view} onChange={setView} />
        </div>

        {view === "list" ? (
          <Card className="overflow-hidden">
            {filteredInstallers.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  icon={<Package size={24} />}
                  title="No installers found"
                  description={
                    search
                      ? "No installers match your search."
                      : `No installer files were found in ${settings?.path}`
                  }
                />
              </div>
            ) : (
              filteredInstallers.map((file, index) => (
                <div
                  key={file.path}
                  className={`
						flex items-center justify-between
						px-5 py-4
						hover:bg-(--background)
						hover:translate-x-1
						transition-all
						${index !== filteredInstallers.length - 1 ? "border-b border-(--border)/10" : ""}
					`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-(--accent)/15 flex items-center justify-center shrink-0">
                      <Package size={18} className="text-(--accent)" />
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-xs text-(--text-muted)">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    icon={<Download size={16} />}
                    onClick={() => download(file.path)}
                  />
                </div>
              ))
            )}
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredInstallers.map((file) => (
              <Card key={file.path} className="p-5 flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-(--accent)/15 flex items-center justify-center shrink-0">
                    <Package size={20} className="text-(--accent)" />
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium truncate">{file.name}</div>

                    <div className="text-xs text-(--text-muted)">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                </div>

                <Button
                  icon={<Download size={16} />}
                  onClick={() => download(file.path)}
                >
                  Download
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </NotPermitted>
  );
}
