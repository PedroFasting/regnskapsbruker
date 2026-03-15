/**
 * API: GET/POST /api/companies/[id]/documents
 *
 * GET  — Hent alle dokumenter for et selskap (valgfritt filtrert på cycleId og category)
 * POST — RF laster opp dokumenter direkte på selskap+syklus (uten oppgave)
 *
 * Aksepterer multipart/form-data med felt "files" og "category" + "cycleId".
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, accountants, documents, cycles } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const VALID_CATEGORIES = ["bilag", "bankutskrift", "aapningsbalanse", "annet"] as const;

async function verifyRfOwnership(userId: string, companyId: string) {
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, userId))
    .limit(1);

  if (!accountant) return null;

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.accountantId, accountant.id)))
    .limit(1);

  return company;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const company = await verifyRfOwnership(session.user.id, id);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const cycleId = request.nextUrl.searchParams.get("cycleId");
  const category = request.nextUrl.searchParams.get("category");

  const conditions = [eq(documents.companyId, id)];
  if (cycleId) conditions.push(eq(documents.cycleId, cycleId));
  if (category) {
    conditions.push(eq(documents.category, category as typeof VALID_CATEGORIES[number]));
  }

  const docs = await db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(asc(documents.uploadedAt));

  return NextResponse.json(docs);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  const company = await verifyRfOwnership(session.user.id, id);
  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files");
  const cycleId = formData.get("cycleId") as string;
  const category = (formData.get("category") as string) || "bilag";

  if (!cycleId) {
    return NextResponse.json({ error: "cycleId er påkrevd" }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: `Ugyldig kategori: ${category}` }, { status: 400 });
  }

  // Verifiser syklus tilhører selskapet
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.id, cycleId), eq(cycles.companyId, id)))
    .limit(1);

  if (!cycle) {
    return NextResponse.json({ error: "Syklus ikke funnet" }, { status: 404 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Ingen filer lastet opp" }, { status: 400 });
  }

  const savedDocuments = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Filtypen ${file.type} er ikke tillatt. Tillatt: PDF, JPEG, PNG, XLSX, CSV.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `${file.name} er for stor (maks 25 MB)` },
        { status: 400 }
      );
    }

    // Lagringsbane: uploads/{companyId}/{cycleId}/rf-upload/{timestamp}-{filename}
    const storagePath = path.join(id, cycleId, "rf-upload");
    const storageDir = path.join(UPLOAD_DIR, storagePath);
    await mkdir(storageDir, { recursive: true });

    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedFilename = `${timestamp}-${safeFilename}`;
    const fullPath = path.join(storageDir, storedFilename);

    const bytes = await file.arrayBuffer();
    await writeFile(fullPath, Buffer.from(bytes));

    const [doc] = await db
      .insert(documents)
      .values({
        taskId: null,
        companyId: id,
        cycleId,
        category: category as typeof VALID_CATEGORIES[number],
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
      category: doc.category,
    })),
  });
}
