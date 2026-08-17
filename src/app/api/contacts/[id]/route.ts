/** @format */

import { NextRequest, NextResponse } from "next/server";
import { getContact, writeContact, deleteContact } from "@/lib/contacts";
import { registerCompanySafely } from "@/lib/companies";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const contact = await getContact(id);

    if (!contact) {
      return NextResponse.json(
        {
          error: "Contact not found",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to load contact",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const body = await request.json();

    const contact = await getContact(id);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const updatedContact = {
      ...contact,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };

    await writeContact(updatedContact);
    if (updatedContact.company) {
      await registerCompanySafely(updatedContact.company);
    }

    return NextResponse.json(updatedContact);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to update contact",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const contact = await getContact(id);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await deleteContact(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to delete contact",
      },
      {
        status: 500,
      },
    );
  }
}
