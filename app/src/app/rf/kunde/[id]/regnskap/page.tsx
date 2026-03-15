import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  companies,
  accountants,
  cycles,
  accounts,
  openingBalances,
  documents,
  tasks,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { RegnskapView } from "./regnskap-view";

export default async function RegnskapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Verifiser RF-tilgang
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) redirect("/login");

  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(eq(companies.id, id), eq(companies.accountantId, accountant.id))
    )
    .limit(1);

  if (!company) notFound();

  // Hent aktiv syklus
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.companyId, company.id), eq(cycles.status, "aktiv")))
    .limit(1);

  if (!cycle) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <p className="text-ecit-navy/50">Ingen aktiv syklus funnet.</p>
      </div>
    );
  }

  // Hent kontoplan
  const accountList = await db
    .select()
    .from(accounts)
    .where(eq(accounts.companyId, company.id))
    .orderBy(asc(accounts.accountNumber));

  // Hent eksisterende åpningsbalanser
  const balances = await db
    .select()
    .from(openingBalances)
    .where(
      and(
        eq(openingBalances.companyId, company.id),
        eq(openingBalances.cycleId, cycle.id)
      )
    );

  // Map accountId -> balance
  const balanceMap: Record<string, string> = {};
  for (const b of balances) {
    balanceMap[b.accountId] = b.balance;
  }

  // Hent alle dokumenter for selskapet (fra kunde via oppgaver + RF-opplastede)
  const companyDocs = await db
    .select({
      id: documents.id,
      taskId: documents.taskId,
      category: documents.category,
      originalFilename: documents.originalFilename,
      fileType: documents.fileType,
      fileSize: documents.fileSize,
      uploadedAt: documents.uploadedAt,
      status: documents.status,
    })
    .from(documents)
    .where(eq(documents.companyId, company.id))
    .orderBy(asc(documents.uploadedAt));

  // Hent oppgave-titler for kontekst (bare for docs med taskId)
  const taskIds = [...new Set(companyDocs.map((d) => d.taskId).filter(Boolean))] as string[];
  const taskTitleMap: Record<string, string> = {};
  if (taskIds.length > 0) {
    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.cycleId, cycle.id));
    for (const t of taskRows) {
      taskTitleMap[t.id] = t.title;
    }
  }

  const categoryLabels: Record<string, string> = {
    bilag: "Bilag",
    bankutskrift: "Bankutskrift",
    aapningsbalanse: "Åpningsbalanse",
    annet: "Annet",
  };

  const uploadedDocuments = companyDocs.map((d) => ({
    id: d.id,
    taskId: d.taskId,
    taskTitle: d.taskId ? (taskTitleMap[d.taskId] || "Ukjent oppgave") : null,
    category: d.category,
    categoryLabel: categoryLabels[d.category] || d.category,
    originalFilename: d.originalFilename,
    fileType: d.fileType,
    fileSize: d.fileSize,
    uploadedAt: d.uploadedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/rf/kunde/${company.id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ecit-blue hover:text-ecit-navy"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Tilbake til {company.name}
        </Link>
        <h1 className="text-2xl font-extrabold text-ecit-navy">
          Regnskap — {company.name}
        </h1>
        <p className="font-mono text-sm text-ecit-navy/40">
          Regnskapsår {cycle.year}
        </p>
      </div>

      <RegnskapView
        companyId={company.id}
        cycleId={cycle.id}
        cycleYear={cycle.year}
        accounts={accountList.map((a) => ({
          id: a.id,
          accountNumber: a.accountNumber,
          name: a.name,
          accountClass: a.accountClass,
        }))}
        initialBalances={balanceMap}
        uploadedDocuments={uploadedDocuments}
      />
    </div>
  );
}
