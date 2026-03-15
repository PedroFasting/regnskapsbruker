/**
 * API: POST /api/tasks/[id]/question
 *
 * Kunde har spørsmål om en godkjenningsoppgave.
 * Sender melding til RF (lagres som notifikasjon + e-post).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { varsleOmSpoersmaal } from "@/lib/varsling";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const body = await request.json();
  const { message } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Melding er påkrevd" },
      { status: 400 }
    );
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });
  }

  // Varsle RF med e-post + lagre notifikasjon (fire-and-forget)
  varsleOmSpoersmaal(
    id,
    session.user.name ?? "Kunde",
    message.trim()
  ).catch(() => {});

  return NextResponse.json({ success: true });
}
