/**
 * API: GET /api/tasks/[id]
 *
 * Hent en oppgave med tilhørende dokumenter.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tasks, documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
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

  const taskDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.taskId, id));

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      helpText: task.helpText,
      type: task.type,
      status: task.status,
      deadlineRelative: task.deadlineRelative,
      rfComment: task.rfComment ?? null,
    },
    documents: taskDocuments.map((doc) => ({
      id: doc.id,
      originalFilename: doc.originalFilename,
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt?.toISOString(),
      status: doc.status,
    })),
  });
}
