/**
 * GET /api/companies/[id]/documents/[docId]
 *
 * Last ned et dokument. Fungerer for alle dokumenter uavhengig av taskId.
 * Verifiserer at RF eier selskapet.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, companies, accountants } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: companyId, docId } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  // Hent dokumentet
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.companyId, companyId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Dokument ikke funnet" }, { status: 404 });
  }

  // Verifiser RF-tilgang
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.accountantId, accountant.id)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Les filen fra disk
  const fullPath = path.join(UPLOAD_DIR, doc.storedPath);

  try {
    const fileBuffer = await readFile(fullPath);
    const contentType = doc.fileType || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalFilename)}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Filen ble ikke funnet på disk" }, { status: 404 });
  }
}
