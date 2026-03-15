/**
 * API: POST /api/tasks/[id]/rf-review
 *
 * RF godkjenner eller ber om mer fra en levert oppgave.
 * Body: { action: "godkjenn" | "trenger_mer", comment?: string }
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { varsleOmTrengerMer } from "@/lib/varsling";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "rf") {
    return NextResponse.json({ error: "Kun RF kan gjennomgå oppgaver" }, { status: 403 });
  }

  const body = await request.json();
  const { action, comment } = body;

  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });
  }

  if (task.status !== "levert") {
    return NextResponse.json(
      { error: "Oppgaven er ikke i status 'levert'" },
      { status: 400 }
    );
  }

  if (action === "godkjenn") {
    await db
      .update(tasks)
      .set({
        status: "godkjent",
        approvedAt: new Date(),
      })
      .where(eq(tasks.id, id));
  } else if (action === "trenger_mer") {
    await db
      .update(tasks)
      .set({
        status: "trenger_mer",
        rfComment: comment || null,
        deliveredAt: null,
      })
      .where(eq(tasks.id, id));

    // Varsle kunde (fire-and-forget)
    varsleOmTrengerMer(id, comment || undefined).catch(() => {});
  } else {
    return NextResponse.json(
      { error: "Ugyldig action. Bruk 'godkjenn' eller 'trenger_mer'" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
