import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import path from "path";

const companiesDir = path.join(process.cwd(), "data", "companies");
const legacyCompaniesPath = path.join(process.cwd(), "data", "companies.json");

export type Company = {
  id: string;
  name: string;
  color: string;
  address: any;
  phone?: string;
  email?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
};

async function ensureMigrated() {
  if (!existsSync(companiesDir)) {
    mkdirSync(companiesDir, { recursive: true });
  }

  if (existsSync(legacyCompaniesPath)) {
    try {
      const file = await fs.readFile(legacyCompaniesPath, "utf8");
      const parsed = JSON.parse(file);
      if (Array.isArray(parsed)) {
        for (const company of parsed) {
          if (company && company.id) {
            await fs.writeFile(
              path.join(companiesDir, `${company.id}.json`),
              JSON.stringify(company, null, 2),
              "utf8",
            );
          }
        }
      }
      await fs.rename(legacyCompaniesPath, `${legacyCompaniesPath}.migrated`);
    } catch (e) {
      console.error("Failed to migrate companies.json", e);
    }
  }
}

export async function getCompanies(): Promise<Company[]> {
  await ensureMigrated();
  try {
    const files = await fs.readdir(companiesDir);
    const companies: Company[] = [];
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await fs.readFile(
          path.join(companiesDir, file),
          "utf8",
        );
        companies.push(JSON.parse(content));
      }
    }
    return companies;
  } catch (e) {
    return [];
  }
}

export async function getCompany(id: string): Promise<Company | null> {
  await ensureMigrated();
  try {
    const content = await fs.readFile(
      path.join(companiesDir, `${id}.json`),
      "utf8",
    );
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

export async function writeCompany(company: Company) {
  await ensureMigrated();
  await fs.writeFile(
    path.join(companiesDir, `${company.id}.json`),
    JSON.stringify(company, null, 2),
    "utf8",
  );
}

export async function deleteCompany(id: string) {
  await ensureMigrated();
  try {
    await fs.unlink(path.join(companiesDir, `${id}.json`));
  } catch (e) {}
}

export async function registerCompanySafely(companyName: string) {
  if (!companyName || !companyName.trim()) return;
  const trimmed = companyName.trim();
  const companies = await getCompanies();

  if (!companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    const now = new Date().toISOString();
    await writeCompany({
      id: `c_${Date.now()}`,
      name: trimmed,
      color: "#A4B795",
      address: {
        street: "",
        number: "",
        postalCode: "",
        city: "",
        country: "",
        lat: 0,
        lng: 0,
      },
      phone: "",
      email: "",
      website: "",
      createdAt: now,
      updatedAt: now,
    });
  }
}
