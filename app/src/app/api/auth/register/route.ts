/**
 * API: POST /api/auth/register
 *
 * Registrer ny regnskapsfører (RF).
 * Oppretter bruker + accountant-rad.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, accountants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, password, firmName } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Navn, e-post og passord er påkrevd" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Passord må være minst 8 tegn" },
      { status: 400 }
    );
  }

  // Sjekk om e-posten allerede er registrert
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "E-postadressen er allerede registrert" },
      { status: 409 }
    );
  }

  // Hash passord
  const passwordHash = await bcrypt.hash(password, 12);

  // Opprett bruker
  const [user] = await db
    .insert(users)
    .values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: "rf",
    })
    .returning();

  // Opprett accountant-profil
  await db.insert(accountants).values({
    userId: user.id,
    firmName: firmName || null,
  });

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
