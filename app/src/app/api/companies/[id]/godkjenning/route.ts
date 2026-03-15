/**
 * API: POST /api/companies/[id]/godkjenning
 *
 * RF sender selskapet til godkjenning.
 * 1. RF laster opp årsregnskap og evt. generalforsamlingsprotokoll
 * 2. Oppgavene "Godkjenn årsregnskap" og "Signer generalforsamlingsprotokoll" aktiveres
 * 3. Kunden mottar varsel
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  companies,
  accountants,
  cycles,
  tasks,
  documents,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { varsleOmGodkjenningKlar } from "@/lib/varsling";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "rf") {
    return NextResponse.json(
      { error: "Kun regnskapsførere kan sende til godkjenning" },
      { status: 403 }
    );
  }

  // Verifiser at RF eier selskapet
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) {
    return NextResponse.json({ error: "RF-profil ikke funnet" }, { status: 400 });
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(eq(companies.id, companyId), eq(companies.accountantId, accountant.id))
    )
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  // Finn aktiv syklus
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(
      and(eq(cycles.companyId, companyId), eq(cycles.status, "aktiv"))
    )
    .limit(1);

  if (!cycle) {
    return NextResponse.json(
      { error: "Ingen aktiv syklus for selskapet" },
      { status: 400 }
    );
  }

  // Parse multipart form data
  const formData = await request.formData();
  const message = formData.get("message") as string | null;
  const files = formData.getAll("files");

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Last opp minst ett dokument" },
      { status: 400 }
    );
  }

  // Finn godkjenningsoppgavene (type = "godkjenning")
  const godkjenningsoppgaver = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.cycleId, cycle.id),
        eq(tasks.type, "godkjenning")
      )
    );

  if (godkjenningsoppgaver.length === 0) {
    return NextResponse.json(
      { error: "Fant ingen godkjenningsoppgaver for syklusen" },
      { status: 400 }
    );
  }

  // Lagre opplastede filer og knytt til første godkjenningsoppgave
  const targetTask = godkjenningsoppgaver[0];
  const storagePath = path.join(companyId, cycle.id, targetTask.id);
  const storageDir = path.join(UPLOAD_DIR, storagePath);
  await mkdir(storageDir, { recursive: true });

  for (const file of files) {
    if (!(file instanceof File)) continue;

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFilename = `${timestamp}-${safeFilename}`;
    const fullPath = path.join(storageDir, storedFilename);

    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    await db.insert(documents).values({
      taskId: targetTask.id,
      companyId,
      cycleId: cycle.id,
      originalFilename: file.name,
      storedPath: path.join(storagePath, storedFilename),
      fileType: file.type,
      fileSize: file.size,
      uploadedBy: session.user.id,
      status: "lastet_opp",
    });
  }

  // Aktiver godkjenningsoppgavene (sett status til ikke_startet, de var allerede det men
  // oppdater rfComment med melding)
  const taskIds = godkjenningsoppgaver.map((t) => t.id);
  if (message) {
    await db
      .update(tasks)
      .set({ rfComment: message })
      .where(inArray(tasks.id, taskIds));
  }

  // Varsle kunde om at godkjenning er klar (fire-and-forget)
  varsleOmGodkjenningKlar(companyId, message ?? undefined).catch(() => {});

  return NextResponse.json({
    success: true,
    message: `Sendt til godkjenning. ${godkjenningsoppgaver.length} oppgave(r) aktivert.`,
  });
}
