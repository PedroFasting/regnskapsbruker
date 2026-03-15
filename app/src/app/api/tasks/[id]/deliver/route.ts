/**
 * API: POST /api/tasks/[id]/deliver
 *
 * Marker en oppgave som levert av kunden.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { varsleOmLevering } from "@/lib/varsling";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });
  }

  if (task.status !== "ikke_startet" && task.status !== "trenger_mer") {
    return NextResponse.json(
      { error: "Oppgaven kan ikke markeres som levert i nåværende status" },
      { status: 400 }
    );
  }

  await db
    .update(tasks)
    .set({
      status: "levert",
      deliveredAt: new Date(),
    })
    .where(eq(tasks.id, id));

  // Varsle RF (fire-and-forget)
  varsleOmLevering(id).catch(() => {});

  return NextResponse.json({ success: true });
}
