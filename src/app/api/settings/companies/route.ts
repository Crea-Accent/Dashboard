/** @format */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  Company,
  getCompanies,
  getCompany,
  writeCompany,
  deleteCompany,
} from "@/lib/companies";

function generateId() {
  return `c_${Date.now()}`;
}

export async function GET() {
  return NextResponse.json({
    companies: await getCompanies(),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const now = new Date().toISOString();

  const company: Company = {
    id: generateId(),
    name: body.name ?? "",
    color: body.color ?? "#A4B795",
    address: body.address ?? {
      street: "",
      number: "",
      postalCode: "",
      city: "",
      country: "",
      lat: 0,
      lng: 0,
    },
    phone: body.phone ?? "",
    email: body.email ?? "",
    website: body.website ?? "",
    createdAt: now,
    updatedAt: now,
  };

  await writeCompany(company);

  return NextResponse.json({
    company,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const company = await getCompany(body.id);

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const updatedCompany: Company = {
    ...company,
    name: body.name ?? company.name,
    color: body.color ?? company.color,
    address: body.address ?? company.address,
    phone: body.phone ?? company.phone,
    email: body.email ?? company.email,
    website: body.website ?? company.website,
    updatedAt: new Date().toISOString(),
  };

  await writeCompany(updatedCompany);

  return NextResponse.json({
    company: updatedCompany,
  });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing company id" }, { status: 400 });
  }

  const company = await getCompany(id);

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  await deleteCompany(id);

  return NextResponse.json({
    success: true,
  });
}
