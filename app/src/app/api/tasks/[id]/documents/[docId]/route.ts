/**
 * GET /api/tasks/[id]/documents/[docId]
 *
 * Last ned et dokument. Tilgjengelig for både kunde og RF.
 * Verifiserer at brukeren har tilgang til oppgaven/selskapet.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  documents,
  tasks,
  cycles,
  companies,
  accountants,
  contacts,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv": "text/csv",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: taskId, docId } = await params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  }

  // Hent dokumentet
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.taskId, taskId)))
    .limit(1);

  if (!doc) {
    return NextResponse.json(
      { error: "Dokument ikke funnet" },
      { status: 404 }
    );
  }

  // Verifiser tilgang: enten RF som eier selskapet, eller kunde knyttet til selskapet
  const userRole = session.user.role;
  let hasAccess = false;

  if (userRole === "rf") {
    // RF må eie selskapet
    const [accountant] = await db
      .select()
      .from(accountants)
      .where(eq(accountants.userId, session.user.id))
      .limit(1);

    if (accountant) {
      const [company] = await db
        .select()
        .from(companies)
        .where(
          and(
            eq(companies.id, doc.companyId),
            eq(companies.accountantId, accountant.id)
          )
        )
        .limit(1);
      hasAccess = !!company;
    }
  } else if (userRole === "kunde") {
    // Kunde må være kontaktperson for selskapet
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, session.user.id),
          eq(contacts.companyId, doc.companyId)
        )
      )
      .limit(1);
    hasAccess = !!contact;
  }

  if (!hasAccess) {
    return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
  }

  // Les filen fra disk
  const fullPath = path.join(UPLOAD_DIR, doc.storedPath);

  try {
    const fileBuffer = await readFile(fullPath);
    const contentType = MIME_TYPES[doc.fileType] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalFilename)}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Filen ble ikke funnet på disk" },
      { status: 404 }
    );
  }
}
