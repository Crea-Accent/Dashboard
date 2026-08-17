/** @format */
"use client";

import {
  Boxes,
  Building2,
  ClipboardList,
  FolderOpen,
  HardDrive,
  Package,
  Settings,
  Shield,
  Users,
} from "lucide-react";

import Card from "@/components/ui/Card";
import { PERMISSIONS } from "@/lib/permissions";
import Toggle from "@/components/ui/Toggle";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  compareWith?: string[];
};

const icons: Record<string, React.ReactNode> = {
  apps: <Package size={18} />,
  companies: <Building2 size={18} />,
  files: <HardDrive size={18} />,
  general: <Settings size={18} />,
  permissions: <Shield size={18} />,
  procedures: <ClipboardList size={18} />,
  projects: <FolderOpen size={18} />,
  roles: <Shield size={18} />,
  users: <Users size={18} />,
  workspace: <Boxes size={18} />,
};

export default function PermissionMatrix({
  value,
  onChange,
  compareWith,
}: Props) {
  const domains = Array.from(
    new Set(PERMISSIONS.map((p) => p.key.split(".")[0])),
  );

  function has(domain: string, type: "read" | "write") {
    return value.includes(`${domain}.${type}`);
  }

  function toggle(domain: string, type: "read" | "write") {
    const key = `${domain}.${type}`;

    let next = [...value];

    if (next.includes(key)) {
      next = next.filter((p) => p !== key);

      // Removing read also removes write.
      if (type === "read") {
        next = next.filter((p) => p !== `${domain}.write`);
      }
    } else {
      next.push(key);

      // Write implies read.
      if (type === "write" && !next.includes(`${domain}.read`)) {
        next.push(`${domain}.read`);
      }
    }

    onChange(next);
  }

  function override(domain: string, type: "read" | "write") {
    if (!compareWith) return false;

    return (
      compareWith.includes(`${domain}.${type}`) !==
      value.includes(`${domain}.${type}`)
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {domains.map((domain) => (
        <Card key={domain} className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-(--accent)">
              {icons[domain] ?? <Shield size={18} />}
            </div>

            <div className="font-semibold capitalize">{domain}</div>
          </div>

          <div className="space-y-3">
            {(["read", "write"] as const).map((type) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {type === "read" ? "Read" : "Write"}
                  </span>

                  {override(domain, type) && (
                    <div
                      className="h-2 w-2 rounded-full bg-yellow-400"
                      title="Override"
                    />
                  )}
                </div>

                <Toggle
                  checked={has(domain, type)}
                  onChange={() => toggle(domain, type)}
                />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
