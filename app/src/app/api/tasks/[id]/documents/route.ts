/**
 * API: POST /api/tasks/[id]/documents
 *
 * Last opp dokumenter til en oppgave.
 * MVP: lagrer filer midlertidig lokalt. Skal byttes til S3 med presigned URLs.
 *
 * Aksepterer multipart/form-data med felt "files".
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, documents, cycles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// MVP: lokal fillagring. Byttes til S3 senere.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

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

  if (task.type !== "dokument_opplasting") {
    return NextResponse.json(
      { error: "Denne oppgaven støtter ikke filopplasting" },
      { status: 400 }
    );
  }

  // Hent syklus for å finne companyId
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(eq(cycles.id, task.cycleId))
    .limit(1);

  if (!cycle) {
    return NextResponse.json(
      { error: "Syklus ikke funnet" },
      { status: 404 }
    );
  }

  const formData = await request.formData();
  const files = formData.getAll("files");

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Ingen filer lastet opp" },
      { status: 400 }
    );
  }

  const savedDocuments = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    // Validér filtype
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Filtypen ${file.type} er ikke tillatt. Tillatt: PDF, JPEG, PNG, XLSX, CSV.`,
        },
        { status: 400 }
      );
    }

    // Validér størrelse
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `${file.name} er for stor (maks 25 MB)` },
        { status: 400 }
      );
    }

    // Generér lagringsbane: uploads/{companyId}/{cycleId}/{taskId}/{timestamp}-{filename}
    const storagePath = path.join(
      cycle.companyId,
      cycle.id,
      task.id,
    );
    const storageDir = path.join(UPLOAD_DIR, storagePath);
    await mkdir(storageDir, { recursive: true });

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFilename = `${timestamp}-${safeFilename}`;
    const fullPath = path.join(storageDir, storedFilename);

    // Skriv fil til disk
    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    // Lagre metadata i databasen
    const [doc] = await db
      .insert(documents)
      .values({
        taskId: task.id,
        companyId: cycle.companyId,
        cycleId: cycle.id,
        originalFilename: file.name,
        storedPath: path.join(storagePath, storedFilename),
        fileType: file.type,
        fileSize: file.size,
        uploadedBy: session.user.id,
        status: "lastet_opp",
      })
      .returning();

    savedDocuments.push(doc);
  }

  return NextResponse.json({
    success: true,
    documents: savedDocuments.map((doc) => ({
      id: doc.id,
      originalFilename: doc.originalFilename,
      fileSize: doc.fileSize,
    })),
  });
}
