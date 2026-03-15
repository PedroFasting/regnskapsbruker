/**
 * API: POST /api/tasks/[id]/approve
 *
 * Kunde godkjenner en oppgave (årsregnskap eller generalforsamlingsprotokoll).
 * Logger godkjenning med tidsstempel, IP-adresse og user agent.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, approvals, cycles, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { varsleOmGodkjenning } from "@/lib/varsling";

export async function POST(
  request: Request,
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

  if (task.type !== "godkjenning") {
    return NextResponse.json(
      { error: "Kun godkjenningsoppgaver kan godkjennes" },
      { status: 400 }
    );
  }

  if (task.status === "godkjent") {
    return NextResponse.json(
      { error: "Oppgaven er allerede godkjent" },
      { status: 400 }
    );
  }

  // Hent syklus for companyId
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(eq(cycles.id, task.cycleId))
    .limit(1);

  if (!cycle) {
    return NextResponse.json({ error: "Syklus ikke funnet" }, { status: 404 });
  }

  // Finn evt. tilknyttet dokument
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.taskId, id))
    .limit(1);

  // Hent IP og user agent for audit log
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Bestem godkjenningstype basert på oppgavetittel
  const approvalType = task.title.toLowerCase().includes("generalforsamling")
    ? "generalforsamling" as const
    : "aarsregnskap" as const;

  // Opprett godkjenningslogg
  await db.insert(approvals).values({
    companyId: cycle.companyId,
    cycleId: cycle.id,
    documentId: doc?.id ?? null,
    type: approvalType,
    approvedBy: session.user.id,
    ipAddress: ip,
    userAgent: userAgent,
  });

  // Oppdater oppgavestatus
  await db
    .update(tasks)
    .set({
      status: "godkjent",
      approvedAt: new Date(),
    })
    .where(eq(tasks.id, id));

  // Varsle RF om godkjenning (fire-and-forget)
  varsleOmGodkjenning(id).catch(() => {});

  return NextResponse.json({ success: true });
}
