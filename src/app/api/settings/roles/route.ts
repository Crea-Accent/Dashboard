/** @format */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Role, getRoles, getRole, writeRole, deleteRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId");

  const roles = await getRoles();

  if (!companyId) {
    return NextResponse.json({ roles });
  }

  return NextResponse.json({
    roles: roles.filter((role) => role.companyId === companyId),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, name, defaultPermissions } = body || {};

  if (!companyId || !name)
    return NextResponse.json({ error: "Missing role name" }, { status: 400 });

  const newRole: Role = {
    id: `r_${Date.now()}`,
    companyId,
    name,
    defaultPermissions: defaultPermissions ?? [],
  };

  await writeRole(newRole);

  const roles = await getRoles();
  return NextResponse.json({ roles });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, companyId, name, defaultPermissions } = body || {};

  if (!id) {
    return NextResponse.json({ error: "Missing role id" }, { status: 400 });
  }

  const role = await getRole(id);

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  if (name) role.name = name;
  if (companyId) role.companyId = companyId;
  if (Array.isArray(defaultPermissions))
    role.defaultPermissions = defaultPermissions;

  await writeRole(role);

  const roles = await getRoles();
  return NextResponse.json({ roles });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing role id" }, { status: 400 });
  }

  await deleteRole(id);

  const nextRoles = await getRoles();
  return NextResponse.json({ roles: nextRoles });
}
