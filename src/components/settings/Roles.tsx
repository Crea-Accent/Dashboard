/** @format */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import Button from "../ui/Button";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import PageHeader from "../ui/PageHeader";
import PermissionMatrix from "./PermissionMatrix";
import Selector from "../ui/Selector";

type Role = {
  id: string;
  name: string;
  defaultPermissions: string[];
};

type Company = {
  id: string;
  name: string;
};

export default function RoleSettings() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");

  async function loadCompanies() {
    const res = await fetch("/api/settings/companies");
    const data = await res.json();

    setCompanies(data.companies ?? []);

    if (!companyId && data.companies.length) {
      setCompanyId(data.companies[0].id);
    }
  }

  async function load() {
    const t = Date.now();
    const res = await fetch(
      `/api/settings/roles?companyId=${companyId}&_t=${t}`,
    );
    const data = await res.json();
    setRoles(data.roles);
  }

  async function saveRole(role: Role) {
    await fetch("/api/settings/roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(role),
    });
    load();
  }

  async function createRole() {
    if (!newRoleName.trim()) return;

    await fetch("/api/settings/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        name: newRoleName,
        defaultPermissions: [],
      }),
    });

    setNewRoleName("");
    setCreating(false);
    load();
  }

  async function deleteRole(id: string) {
    await fetch(`/api/settings/roles?id=${id}`, {
      method: "DELETE",
    });
    load();
  }

  function updateRoleName(role: Role, name: string) {
    setRoles((roles) =>
      roles.map((r) =>
        r.id === role.id
          ? {
              ...r,
              name,
            }
          : r,
      ),
    );
  }

  function updatePermissions(role: Role, defaultPermissions: string[]) {
    setRoles((roles) =>
      roles.map((r) =>
        r.id === role.id
          ? {
              ...r,
              defaultPermissions,
            }
          : r,
      ),
    );
  }

  useEffect(() => {
    load();
    loadCompanies();
  }, []);

  useEffect(() => {
    if (companyId) {
      load();
    }
  }, [companyId]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Shield size={20} />}
        title="Roles"
        description="Manage permission templates for each company."
      />

      {/* Header */}

      <div className="flex flex-wrap justify-between gap-4 items-end">
        <div className="w-80">
          <Selector
            value={companyId}
            options={companies.map((company) => ({
              label: company.name,
              value: company.id,
            }))}
            onChange={setCompanyId}
          />
        </div>

        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New Role
        </Button>
      </div>

      {/* Roles */}

      {roles.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title="No Roles"
          description="Create the first role for this company."
        />
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const expanded = expandedRole === role.id;

            return (
              <Card key={role.id} className="overflow-hidden">
                {/* Header */}

                <div className="p-6 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Input
                      value={role.name}
                      onChange={(e) => updateRoleName(role, e.target.value)}
                      disabled={!expanded}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      icon={
                        expanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )
                      }
                      onClick={() => setExpandedRole(expanded ? null : role.id)}
                    />

                    <Button
                      variant="danger"
                      icon={<Trash2 size={16} />}
                      onClick={() => deleteRole(role.id)}
                    />
                  </div>
                </div>

                {/* Permissions */}

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0,
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                      }}
                      transition={{
                        duration: 0.2,
                      }}
                      className="overflow-hidden border-t border-(--border)/10"
                    >
                      <div className="p-6 space-y-6">
                        <PermissionMatrix
                          value={role.defaultPermissions}
                          onChange={(permissions) =>
                            updatePermissions(role, permissions)
                          }
                        />

                        <div className="flex justify-end">
                          <Button
                            icon={<Shield size={16} />}
                            onClick={() => saveRole(role)}
                          >
                            Save Role
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
      )}

      {/* Create */}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Role"
        size="md"
      >
        <div className="space-y-6">
          <Input
            label="Role Name"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>

            <Button icon={<Plus size={16} />} onClick={createRole}>
              Create Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
