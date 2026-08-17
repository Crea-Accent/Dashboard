/** @format */
"use client";

import {
  Boxes,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  FolderOpen,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { APIProvider } from "@vis.gl/react-google-maps";
import AppsSettings from "@/components/settings/Apps";
import CompaniesSettings from "@/components/settings/Companies";
import GeneralSettings from "@/components/settings/General";
import { NotPermitted } from "@/providers/PermissionsProvider";
import ProceduresSettings from "@/components/settings/Procedures";
import ProjectSettings from "@/components/settings/Projects";
import RoleSettings from "@/components/settings/Roles";
import Tabs from "@/components/ui/Tabs";
import UserSettings from "@/components/settings/Users";
import Workspace from "@/components/settings/Workspace";
import { motion } from "framer-motion";
import { useState } from "react";

type Tab =
  | "general"
  | "projects"
  | "workspace"
  | "procedures"
  | "apps"
  | "users"
  | "roles"
  | "companies";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <NotPermitted permission="admin.read">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <div className="space-y-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                id: "general",
                label: "General",
                icon: <SlidersHorizontal size={16} />,
              },
              {
                id: "projects",
                label: "Projects",
                icon: <FolderOpen size={16} />,
              },
              {
                id: "workspace",
                label: "Workspace",
                icon: <BriefcaseBusiness size={16} />,
              },
              {
                id: "procedures",
                label: "Procedures",
                icon: <ClipboardList size={16} />,
              },
              {
                id: "apps",
                label: "Apps",
                icon: <Boxes size={16} />,
              },
              {
                id: "users",
                label: "Users",
                icon: <Users size={16} />,
              },
              {
                id: "roles",
                label: "Roles",
                icon: <ShieldCheck size={16} />,
              },
              {
                id: "companies",
                label: "Companies",
                icon: <Building2 size={16} />,
              },
            ]}
          />

          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
            }}
          >
            {tab === "general" && <GeneralSettings />}
            {tab === "projects" && <ProjectSettings />}
            {tab === "workspace" && <Workspace />}
            {tab === "procedures" && <ProceduresSettings />}
            {tab === "apps" && <AppsSettings />}
            {tab === "users" && <UserSettings />}
            {tab === "roles" && <RoleSettings />}
            {tab === "companies" && <CompaniesSettings />}
          </motion.div>
        </div>
      </APIProvider>
    </NotPermitted>
  );
}
