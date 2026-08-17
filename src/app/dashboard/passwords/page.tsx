/** @format */
"use client";

import { Eye, KeyRound, Plus, Search } from "lucide-react";
import { Globe, Pencil, Trash2, User } from "lucide-react";
import { NotPermitted, usePermissions } from "@/providers/PermissionsProvider";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Loading from "@/components/ui/Loading";
import Modal from "@/components/ui/Modal";
import MultiSelector from "@/components/ui/MultiSelector";
import PageHeader from "@/components/ui/PageHeader";
import PasswordInput from "@/components/ui/PasswordInput";
import Selector from "@/components/ui/Selector";
import Tabs from "@/components/ui/Tabs";
import ViewToggle from "@/components/ui/ViewToggle";
import { useSession } from "next-auth/react";

type Password = {
  id: string;
  label: string;
  username?: string;
  password: string;
  tags?: string[];
  link?: string;
  users: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type User = {
  id: string;
  name: string;
  email?: string;
};

export default function PasswordsPage() {
  const { data: session } = useSession();
  const { has } = usePermissions();

  const [loading, setLoading] = useState(true);

  const [passwords, setPasswords] = useState<Password[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [search, setSearch] = useState("");

  const [view, setView] = useState<"grid" | "list">(
    session?.user?.preferences?.defaultView ?? "grid",
  );

  const [tab, setTab] = useState<"vault" | "shared" | "team">("vault");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Password | null>(null);

  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [link, setLink] = useState("");
  const [tags, setTags] = useState("");
  const [sharedUsers, setSharedUsers] = useState<string[]>([]);

  const [viewing, setViewing] = useState<Password | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(false);

  async function savePassword() {
    const body = {
      id: editing?.id,
      label,
      username,
      password,
      link,
      users: sharedUsers,
      tags: tags
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };

    const res = await fetch("/api/passwords", {
      method: editing ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) return;

    if (editing) {
      setPasswords((prev) =>
        prev.map((p) => (p.id === data.password.id ? data.password : p)),
      );
    } else {
      setPasswords((prev) => [...prev, data.password]);
    }

    setOpen(false);
  }

  async function viewPassword(id: string) {
    setLoadingPassword(true);

    try {
      const res = await fetch(`/api/passwords?id=${id}`);

      if (!res.ok) return;

      const data = await res.json();

      setViewing(data.password);
    } finally {
      setLoadingPassword(false);
    }
  }

  async function removePassword(id: string) {
    if (!confirm("Delete this password?")) return;

    const res = await fetch(`/api/passwords?id=${id}`, {
      method: "DELETE",
    });

    if (!res.ok) return;

    setPasswords((prev) => prev.filter((p) => p.id !== id));

    if (viewing?.id === id) {
      setViewing(null);
    }
  }

  async function editPassword(id: string) {
    const res = await fetch(`/api/passwords?id=${id}`);

    if (!res.ok) return;

    const data = await res.json();

    const pw = data.password;

    setEditing(pw);

    setLabel(pw.label);
    setUsername(pw.username ?? "");
    setPassword(pw.password);
    setLink(pw.link ?? "");
    setTags(pw.tags?.join(", ") ?? "");
    setSharedUsers(pw.users);

    setViewing(null);
    setOpen(true);
  }

  useEffect(() => {
    (async () => {
      const [pwRes, userRes] = await Promise.all([
        fetch("/api/passwords"),
        fetch("/api/users"),
      ]);

      const pw = await pwRes.json();
      const us = await userRes.json();

      setPasswords(pw.passwords ?? []);
      setUsers(us.users ?? us);

      setLoading(false);
    })();
  }, []);

  const me = useMemo(() => {
    return users.find(
      (u) => u.email?.toLowerCase() === session?.user?.email?.toLowerCase(),
    );
  }, [users, session]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return passwords.filter((p) => {
      if (tab === "vault" && p.ownerId !== me?.id) return false;

      if (tab === "shared") {
        const visible = p.ownerId !== me?.id && p.users.includes(me?.id ?? "");

        if (!visible) return false;
      }

      if (q) {
        const hit =
          p.label.toLowerCase().includes(q) ||
          p.username?.toLowerCase().includes(q) ||
          p.link?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q));

        if (!hit) return false;
      }

      return true;
    });
  }, [passwords, tab, search, me]);

  if (loading)
    return (
      <Loading
        title="Loading Password Vault"
        description="Decrypting absolutely nothing yet."
      />
    );

  return (
    <NotPermitted permission="passwords.read">
      <div className="space-y-6">
        <PageHeader
          icon={<KeyRound size={20} />}
          title="Passwords"
          description="Secure credentials for projects and infrastructure."
        />

        <Card className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex-1">
              <Input
                icon={<Search size={16} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search passwords..."
              />
            </div>

            <ViewToggle value={view} onChange={setView} />

            {has("passwords.write") && (
              <Button
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditing(null);

                  setLabel("");
                  setUsername("");
                  setPassword("");
                  setLink("");
                  setTags("");
                  setSharedUsers([]);

                  setOpen(true);
                }}
              >
                New Password
              </Button>
            )}
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: "vault",
                label: "Vault",
                count: passwords.filter((x) => x.ownerId === me?.id).length,
              },
              {
                id: "shared",
                label: "Shared",
                count: passwords.filter(
                  (x) => x.ownerId !== me?.id && x.users.includes(me?.id ?? ""),
                ).length,
              },
              ...(has("admin.read")
                ? [
                    {
                      id: "team" as const,
                      label: "Team",
                    },
                  ]
                : []),
            ]}
          />
        </Card>

        {filtered.length === 0 && (
          <EmptyState
            icon={<KeyRound size={28} />}
            title="No passwords found"
            description="Try changing your search or create a new password."
          />
        )}

        {/* GRID */}

        {view === "grid" && tab !== "team" && (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((password) => (
              <PasswordCard
                key={password.id}
                password={password}
                owner={users.find((u) => u.id === password.ownerId)}
                showOwner={has("admin.read")}
                onView={() => viewPassword(password.id)}
                onEdit={
                  password.ownerId === me?.id || has("admin.read")
                    ? () => editPassword(password.id)
                    : undefined
                }
                onDelete={
                  password.ownerId === me?.id || has("admin.read")
                    ? () => removePassword(password.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* LIST */}

        {view === "list" && tab !== "team" && (
          <div className="space-y-3">
            {filtered.map((password) => (
              <PasswordCard
                key={password.id}
                password={password}
                owner={users.find((u) => u.id === password.ownerId)}
                showOwner={has("admin.read")}
                onView={() => viewPassword(password.id)}
                onEdit={
                  password.ownerId === me?.id || has("admin.read")
                    ? () => editPassword(password.id)
                    : undefined
                }
                onDelete={
                  password.ownerId === me?.id || has("admin.read")
                    ? () => removePassword(password.id)
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* TEAM */}

        {tab === "team" && (
          <div className="space-y-6">
            {users.map((user) => {
              const owned = passwords.filter((p) => p.ownerId === user.id);

              if (!owned.length) return null;

              return (
                <Card key={user.id} className="p-5">
                  <h2 className="font-semibold text-lg mb-4">{user.name}</h2>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {owned.map((pw) => (
                      <PasswordCard
                        key={pw.id}
                        password={pw}
                        owner={user}
                        showOwner={false}
                        onView={() => viewPassword(pw.id)}
                        onEdit={
                          has("admin.read")
                            ? () => editPassword(pw.id)
                            : undefined
                        }
                        onDelete={
                          has("admin.read")
                            ? () => removePassword(pw.id)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Save */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Password" : "New Password"}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <PasswordInput
            label="Password"
            value={password}
            onChange={setPassword}
          />

          <Input
            label="Website"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />

          <Input
            label="Tags"
            placeholder="Development, Azure, NAS"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          <MultiSelector
            value={sharedUsers}
            options={users
              .filter((u) => u.id !== me?.id)
              .map((u) => ({
                label: u.name,
                value: u.id,
              }))}
            onChange={(value) => setSharedUsers(value as string[])}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>

            <Button onClick={savePassword}>
              {editing ? "Save Changes" : "Create Password"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.label ?? "Password"}
        size="lg"
      >
        {loadingPassword ? (
          <div className="py-12 text-center">Loading...</div>
        ) : (
          viewing && (
            <div className="space-y-5">
              <Input label="Label" value={viewing.label} readOnly />

              <Input
                label="Username"
                value={viewing.username ?? ""}
                readOnly
                // endContent={<Button size='sm' icon={<Copy size={14} />} onClick={() => navigator.clipboard.writeText(viewing.username ?? '')} />}
              />

              <PasswordInput
                label="Password"
                value={viewing.password}
                readOnly
              />

              <Input label="Website" value={viewing.link ?? ""} readOnly />

              {!!viewing.tags?.length && (
                <div>
                  <p className="text-sm font-medium mb-2">Tags</p>

                  <div className="flex flex-wrap gap-2">
                    {viewing.tags.map((tag) => (
                      <div
                        key={tag}
                        className="px-3 py-1 rounded-full bg-(--accent)/15 text-(--accent) text-xs"
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => window.open(viewing.link, "_blank")}
                    disabled={!viewing.link}
                  >
                    Open Website
                  </Button>
                </div>

                <div className="flex gap-2">
                  {has("passwords.write") && (
                    <Button onClick={() => editPassword(viewing.id)}>
                      Edit
                    </Button>
                  )}

                  <Button variant="secondary" onClick={() => setViewing(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </Modal>
    </NotPermitted>
  );
}

type UserType = {
  id: string;
  name: string;
};

type Props = {
  password: Password;
  owner?: UserType;
  showOwner?: boolean;

  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

function PasswordCard({
  password,
  owner,
  showOwner = false,

  onView,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card className="p-5 hover:-translate-y-0.5 transition-all">
      <div className="flex flex-col h-full gap-4">
        <div>
          <h3 className="font-semibold truncate">{password.label}</h3>

          <p className="text-sm text-(--text-muted) truncate">
            {password.username || "No username"}
          </p>
        </div>

        {!!password.tags?.length && (
          <div className="flex flex-wrap gap-2">
            {password.tags.map((tag) => (
              <div
                key={tag}
                className="px-2 py-1 rounded-full bg-(--accent)/15 text-(--accent) text-xs"
              >
                {tag}
              </div>
            ))}
          </div>
        )}

        {password.link && (
          <div className="flex items-center gap-2 text-sm text-(--text-muted) truncate">
            <Globe size={14} />

            <span className="truncate">{password.link}</span>
          </div>
        )}

        {showOwner && owner && (
          <div className="flex items-center gap-2 text-sm text-(--text-muted)">
            <User size={14} />

            <span>{owner.name}</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="flex gap-2">
          <Button className="flex-1" icon={<Eye size={15} />} onClick={onView}>
            View
          </Button>

          {onEdit && (
            <Button
              variant="secondary"
              icon={<Pencil size={15} />}
              onClick={onEdit}
            />
          )}

          {onDelete && (
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={onDelete}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
