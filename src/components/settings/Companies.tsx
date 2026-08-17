/** @format */
"use client";

import { Building2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import AddressInput from "../ui/AddressInput";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";

type Company = {
  id: string;
  name: string;
  color: string;

  address: {
    street: string;
    number: string;
    suite?: string;
    postalCode: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
  };

  phone?: string;
  email?: string;
  website?: string;

  createdAt: string;
  updatedAt: string;
};

const emptyCompany: Omit<Company, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  color: "#4f46e5",

  address: {
    street: "",
    number: "",
    suite: "",
    postalCode: "",
    city: "",
    country: "Belgium",
    lat: 0,
    lng: 0,
  },

  phone: "",
  email: "",
  website: "",
};

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [company, setCompany] = useState(emptyCompany);

  async function load() {
    const res = await fetch("/api/settings/companies");
    const data = await res.json();

    setCompanies(data.companies ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCompany() {
    await fetch("/api/settings/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(company),
    });

    setCreating(false);
    setCompany(emptyCompany);

    load();
  }

  async function saveCompany(company: Company) {
    await fetch("/api/settings/companies", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(company),
    });

    setEditing(null);

    load();
  }

  async function removeCompany(id: string) {
    await fetch(`/api/settings/companies?id=${id}`, {
      method: "DELETE",
    });

    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Building2 size={20} />}
        title="Companies"
        description="Manage companies and client organisations."
      />

      <div className="flex justify-end">
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New Company
        </Button>
      </div>

      {companies.length === 0 && (
        <EmptyState
          icon={<Building2 size={28} />}
          title="No companies"
          description="Create your first company."
        />
      )}

      <div className="space-y-5">
        {companies.map((company) => {
          const edit = editing === company.id;

          return (
            <Card key={company.id} className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{
                      background: company.color,
                    }}
                  />

                  <div>
                    <div className="font-semibold text-lg">{company.name}</div>

                    <div className="text-sm text-(--text-muted)">
                      {company.address.city}
                      {company.address.city && company.address.country
                        ? ", "
                        : ""}
                      {company.address.country}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    icon={<Pencil size={15} />}
                    onClick={() => setEditing(edit ? null : company.id)}
                  />

                  <Button
                    variant="danger"
                    icon={<Trash2 size={15} />}
                    onClick={() => removeCompany(company.id)}
                  />
                </div>
              </div>

              {edit && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      label="Company Name"
                      value={company.name}
                      onChange={(e) =>
                        setCompanies((list) =>
                          list.map((c) =>
                            c.id === company.id
                              ? {
                                  ...c,
                                  name: e.target.value,
                                }
                              : c,
                          ),
                        )
                      }
                    />

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Color</div>

                      <input
                        type="color"
                        value={company.color}
                        onChange={(e) =>
                          setCompanies((list) =>
                            list.map((c) =>
                              c.id === company.id
                                ? {
                                    ...c,
                                    color: e.target.value,
                                  }
                                : c,
                            ),
                          )
                        }
                        className="h-11 w-full rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <Input
                      label="Phone"
                      value={company.phone ?? ""}
                      onChange={(e) =>
                        setCompanies((list) =>
                          list.map((c) =>
                            c.id === company.id
                              ? {
                                  ...c,
                                  phone: e.target.value,
                                }
                              : c,
                          ),
                        )
                      }
                    />

                    <Input
                      label="Email"
                      value={company.email ?? ""}
                      onChange={(e) =>
                        setCompanies((list) =>
                          list.map((c) =>
                            c.id === company.id
                              ? {
                                  ...c,
                                  email: e.target.value,
                                }
                              : c,
                          ),
                        )
                      }
                    />

                    <Input
                      label="Website"
                      value={company.website ?? ""}
                      onChange={(e) =>
                        setCompanies((list) =>
                          list.map((c) =>
                            c.id === company.id
                              ? {
                                  ...c,
                                  website: e.target.value,
                                }
                              : c,
                          ),
                        )
                      }
                    />
                  </div>

                  <AddressInput
                    value={company.address}
                    onChange={(address) =>
                      setCompany({
                        ...company,
                        address,
                      })
                    }
                  />

                  <div className="flex justify-end">
                    <Button
                      icon={<Save size={16} />}
                      onClick={() => saveCompany(company)}
                    >
                      Save Company
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Company"
        size="xl"
      >
        <div className="space-y-6">
          <Input
            label="Company Name"
            value={company.name}
            onChange={(e) =>
              setCompany({
                ...company,
                name: e.target.value,
              })
            }
          />

          <div>
            <div className="text-sm font-medium mb-2">Color</div>

            <input
              type="color"
              value={company.color}
              onChange={(e) =>
                setCompany({
                  ...company,
                  color: e.target.value,
                })
              }
              className="h-11 w-full rounded-xl border border-(--border)"
            />
          </div>

          <AddressInput
            value={company.address}
            onChange={(address) =>
              setCompany({
                ...company,
                address,
              })
            }
          />

          <div className="grid md:grid-cols-3 gap-4">
            <Input
              label="Phone"
              value={company.phone}
              onChange={(e) =>
                setCompany({
                  ...company,
                  phone: e.target.value,
                })
              }
            />

            <Input
              label="Email"
              value={company.email}
              onChange={(e) =>
                setCompany({
                  ...company,
                  email: e.target.value,
                })
              }
            />

            <Input
              label="Website"
              value={company.website}
              onChange={(e) =>
                setCompany({
                  ...company,
                  website: e.target.value,
                })
              }
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              icon={<X size={16} />}
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>

            <Button icon={<Plus size={16} />} onClick={createCompany}>
              Create Company
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
