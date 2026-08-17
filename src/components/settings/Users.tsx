/** @format */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import PermissionMatrix from "./PermissionMatrix";
import Selector from "@/components/ui/Selector";

type UserType = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  companyId: string;
  permissions: string[];
  password?: string;
};

type Role = {
  id: string;
  companyId: string;
  name: string;
  defaultPermissions: string[];
};

type Company = {
  id: string;
  name: string;
};

const emptyUser = {
  name: "",
  email: "",
  password: "",
  companyId: "",
  roleId: "",
};

export default function UserSettings() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const [user, setUser] = useState(emptyUser);

  async function load() {
    const t = Date.now();
    const [usersRes, rolesRes, companiesRes] = await Promise.all([
      fetch(`/api/users?_t=${t}`),
      fetch(`/api/settings/roles?_t=${t}`),
      fetch(`/api/settings/companies?_t=${t}`),
    ]);

    const usersData = await usersRes.json();
    const rolesData = await rolesRes.json();
    const companiesData = await companiesRes.json();

    setUsers(usersData.users ?? []);
    setRoles(rolesData.roles ?? []);
    setCompanies(companiesData.companies ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser() {
    await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });

    setCreating(false);
    setUser(emptyUser);

    load();
  }

  async function saveUser(user: UserType) {
    await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    });

    setEditing(null);

    load();
  }

  async function removeUser(id: string) {
    await fetch(`/api/users?id=${id}`, {
      method: "DELETE",
    });

    load();
  }

  function updateUser(userId: string, update: Partial<UserType>) {
    setUsers((list) =>
      list.map((user) =>
        user.id === userId
          ? {
              ...user,
              ...update,
            }
          : user,
      ),
    );
  }

  function updateRole(userId: string, roleId: string) {
    const role = roles.find((r) => r.id === roleId);

    updateUser(userId, {
      roleId,
      permissions: role ? [...role.defaultPermissions] : [],
    });
  }

  function updateCompany(userId: string, companyId: string) {
    const role = roles.find((r) => r.companyId === companyId);

    updateUser(userId, {
      companyId,
      roleId: role?.id ?? "",
      permissions: role ? [...role.defaultPermissions] : [],
    });
  }

  const companyRoles = useMemo(
    () => roles.filter((r) => r.companyId === user.companyId),
    [user.companyId, roles],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<User size={20} />}
        title="Users"
        description="Manage users, roles and company access."
      />

      <div className="flex justify-end">
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New User
        </Button>
      </div>

      {users.length === 0 && (
        <EmptyState
          icon={<User size={28} />}
          title="No users"
          description="Create your first user."
        />
      )}

      <div className="space-y-5">
        {users.map((user) => {
          const edit = editing === user.id;

          return (
            <Card key={user.id}>
              <div className="p-6 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{user.name}</h3>

                  <p className="text-sm text-(--text-muted)">{user.email}</p>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {companies.find((c) => c.id === user.companyId) && (
                      <div className="px-3 py-1 rounded-full bg-(--active-accent) text-(--accent) text-xs font-medium">
                        {companies.find((c) => c.id === user.companyId)?.name}
                      </div>
                    )}

                    {roles.find((r) => r.id === user.roleId) && (
                      <div className="px-3 py-1 rounded-full bg-(--foreground) text-(--text-muted) text-xs">
                        {roles.find((r) => r.id === user.roleId)?.name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={
                      edit ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    }
                    onClick={() => setEditing(edit ? null : user.id)}
                  />

                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 size={16} />}
                    onClick={() => removeUser(user.id)}
                  />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {edit && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-(--border)/10"
                  >
                    <div className="p-6 space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <Input
                          label="Name"
                          value={user.name}
                          onChange={(e) =>
                            updateUser(user.id, {
                              name: e.target.value,
                            })
                          }
                        />

                        <Input
                          label="Email"
                          value={user.email}
                          onChange={(e) =>
                            updateUser(user.id, {
                              email: e.target.value,
                            })
                          }
                        />

                        <Input
                          label="Password"
                          type="password"
                          placeholder="Leave blank to keep current password"
                          className="md:col-span-2"
                          onChange={(e) =>
                            updateUser(user.id, {
                              password: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <Selector
                          value={user.companyId}
                          options={companies.map((company) => ({
                            label: company.name,
                            value: company.id,
                          }))}
                          onChange={(companyId) =>
                            updateCompany(user.id, companyId)
                          }
                        />

                        <Selector
                          value={user.roleId}
                          options={roles
                            .filter((r) => r.companyId === user.companyId)
                            .map((role) => ({
                              label: role.name,
                              value: role.id,
                            }))}
                          onChange={(roleId) => updateRole(user.id, roleId)}
                        />
                      </div>

                      <PermissionMatrix
                        value={user.permissions}
                        compareWith={
                          roles.find((r) => r.id === user.roleId)
                            ?.defaultPermissions
                        }
                        onChange={(permissions) =>
                          updateUser(user.id, {
                            permissions,
                          })
                        }
                      />

                      <div className="flex justify-end">
                        <Button
                          icon={<Save size={16} />}
                          onClick={() => saveUser(user)}
                        >
                          Save User
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New User"
        size="lg"
      >
        <div className="space-y-6">
          <Input
            label="Name"
            value={user.name}
            onChange={(e) =>
              setUser({
                ...user,
                name: e.target.value,
              })
            }
          />

          <Input
            label="Email"
            type="email"
            value={user.email}
            onChange={(e) =>
              setUser({
                ...user,
                email: e.target.value,
              })
            }
          />

          <Input
            label="Password"
            type="password"
            value={user.password}
            onChange={(e) =>
              setUser({
                ...user,
                password: e.target.value,
              })
            }
          />

          <div className="grid md:grid-cols-2 gap-4">
            <Selector
              value={user.companyId}
              options={companies.map((company) => ({
                label: company.name,
                value: company.id,
              }))}
              onChange={(companyId) => {
                const role = roles.find((r) => r.companyId === companyId);

                setUser({
                  ...user,
                  companyId,
                  roleId: role?.id ?? "",
                });
              }}
            />

            <Selector
              value={user.roleId}
              options={roles
                .filter((r) => r.companyId === user.companyId)
                .map((role) => ({
                  label: role.name,
                  value: role.id,
                }))}
              onChange={(roleId) =>
                setUser({
                  ...user,
                  roleId,
                })
              }
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false);
                setUser(emptyUser);
              }}
            >
              Cancel
            </Button>

            <Button icon={<Plus size={16} />} onClick={createUser}>
              Create User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
