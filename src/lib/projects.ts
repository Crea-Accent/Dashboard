/** @format */

import fs from "fs";
import path from "path";

export type PortalProject = {
  id: string;
  name: string;
};

type Metadata = {
  name: string;
  access?: string[];
};

type ProjectSettings = {
  path: string;
};

export function getUserProjects(userId: string): PortalProject[] {
  const settingsPath = path.join(process.cwd(), "data", "projects.json");

  if (!fs.existsSync(settingsPath)) return [];

  const settings: ProjectSettings = JSON.parse(
    fs.readFileSync(settingsPath, "utf8"),
  );

  if (!settings.path) return [];

  const projectsPath = path.isAbsolute(settings.path)
    ? settings.path
    : path.join(/*turbopackIgnore: true*/ process.cwd(), settings.path);

  if (!fs.existsSync(projectsPath)) return [];

  const projects: PortalProject[] = [];

  for (const folder of fs.readdirSync(projectsPath, {
    withFileTypes: true,
  })) {
    if (!folder.isDirectory()) continue;

    const metadataPath = path.join(projectsPath, folder.name, "metadata.json");

    if (!fs.existsSync(metadataPath)) continue;

    try {
      const metadata: Metadata = JSON.parse(
        fs.readFileSync(metadataPath, "utf8"),
      );

      if (metadata.access?.includes(userId)) {
        projects.push({
          id: folder.name,
          name: metadata.name,
        });
      }
    } catch {}
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}
