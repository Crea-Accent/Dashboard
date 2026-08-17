/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { LucideHome } from "lucide-react";

export function useFileNavigation() {
  const [root, setRoot] = useState("");
  const [currentPath, setCurrentPath] = useState("");

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const settings = await fetch("/api/settings/files").then((r) => r.json());

      if (!settings?.path) return;

      setRoot(settings.path);
      setCurrentPath(settings.path);
      setHistory([settings.path]);
      setHistoryIndex(0);
    })();
  }, []);

  function navigate(path: string) {
    if (path === currentPath) return;

    const nextHistory = history.slice(0, historyIndex + 1);

    nextHistory.push(path);

    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);

    setCurrentPath(path);
  }

  function goBack() {
    if (historyIndex <= 0) return;

    const nextIndex = historyIndex - 1;

    setHistoryIndex(nextIndex);
    setCurrentPath(history[nextIndex]);
  }

  function goForward() {
    if (historyIndex >= history.length - 1) return;

    const nextIndex = historyIndex + 1;

    setHistoryIndex(nextIndex);
    setCurrentPath(history[nextIndex]);
  }

  function goUp() {
    if (!root || currentPath === root) return;

    const separator = currentPath.includes("\\") ? "\\" : "/";

    const parent = currentPath.split(/[\\/]/).slice(0, -1).join(separator);

    navigate(parent || root);
  }

  const breadcrumbs = useMemo(() => {
    if (!root) return [];

    const normalizedRoot = root.replace(/\\/g, "/");
    const normalizedCurrent = currentPath.replace(/\\/g, "/");

    const relative = normalizedCurrent.startsWith(normalizedRoot)
      ? normalizedCurrent.slice(normalizedRoot.length)
      : "";

    const parts = relative.split("/").filter(Boolean);

    const separator = root.includes("\\") ? "\\" : "/";

    const result = [
      {
        label: "Root",
        path: root,
      },
    ];

    let accumulated = root;

    for (const part of parts) {
      accumulated += separator + part;

      result.push({
        label: part,
        path: accumulated,
      });
    }

    return result;
  }, [currentPath, root]);

  function Breadcrumbs() {
    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center gap-2">
              {index > 0 && <span className="text-(--text-muted)">/</span>}

              <Button variant="ghost" onClick={() => navigate(crumb.path)}>
                {index === 0 ? <LucideHome size={16} /> : crumb.label}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return {
    currentPath,

    navigate,
    goUp,
    goBack,
    goForward,

    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < history.length - 1,
    canGoUp: !!root && currentPath !== root,

    breadcrumbs,
    Breadcrumbs,
  };
}
