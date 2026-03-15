import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  companies,
  accountants,
  cycles,
  tasks,
  documents,
  contacts,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SendTilGodkjenning, RfTaskActions } from "@/components/rf-actions";

function taskStatusBadge(status: string) {
  switch (status) {
    case "ikke_startet":
      return <Badge className="border border-ecit-beige-dark bg-transparent text-ecit-navy/50">Ikke startet</Badge>;
    case "levert":
      return <Badge className="bg-ecit-blue text-white">Levert</Badge>;
    case "godkjent":
      return <Badge className="bg-ecit-green text-white">Godkjent</Badge>;
    case "trenger_mer":
      return <Badge className="bg-ecit-ruby text-white">Trenger mer</Badge>;
    default:
      return <Badge className="border border-ecit-beige-dark bg-transparent text-ecit-navy/50">{status}</Badge>;
  }
}

function taskTypeLabel(type: string) {
  switch (type) {
    case "dokument_opplasting":
      return "Opplasting";
    case "bekreftelse":
      return "Bekreftelse";
    case "godkjenning":
      return "Godkjenning";
    case "signering":
      return "Signering";
    default:
      return type;
  }
}

export default async function RfKundeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Verifiser at RF eier dette selskapet
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

  // Hent oppgaver
  const taskList = cycle
    ? await db
        .select()
        .from(tasks)
        .where(eq(tasks.cycleId, cycle.id))
        .orderBy(asc(tasks.sortOrder))
    : [];

  // Hent kontaktpersoner
  const contactList = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, company.id));

  // Hent dokumenter per oppgave
  const docsMap = new Map<string, typeof documents.$inferSelect[]>();
  if (cycle) {
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.cycleId, cycle.id));
    for (const doc of docs) {
      if (!doc.taskId) continue; // RF-uploaded docs have no task
      const existing = docsMap.get(doc.taskId) || [];
      existing.push(doc);
      docsMap.set(doc.taskId, existing);
    }
  }

  const levert = taskList.filter(
    (t) => t.status === "levert" || t.status === "godkjent"
  ).length;

  // Sjekk om RF kan sende til godkjenning:
  const uploadTasks = taskList.filter((t) => t.type === "dokument_opplasting");
  const allUploadsDelivered =
    uploadTasks.length > 0 &&
    uploadTasks.every((t) => t.status === "levert" || t.status === "godkjent");

  const godkjenningsTasks = taskList.filter((t) => t.type === "godkjenning");
  const godkjenningNotStarted = godkjenningsTasks.some(
    (t) => t.status === "ikke_startet"
  );

  const showSendTilGodkjenning =
    allUploadsDelivered && godkjenningNotStarted && cycle;

  return (
    <div className="mx-auto max-w-3xl p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/rf/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-sm text-ecit-blue hover:text-ecit-navy"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tilbake til kundeoversikt
        </Link>
        <h1 className="text-2xl font-extrabold text-ecit-navy">{company.name}</h1>
        <p className="font-mono text-sm text-ecit-navy/40">
          {company.orgNr}
          {cycle && <span className="ml-2 font-sans text-ecit-navy/50">Regnskapsår {cycle.year}</span>}
        </p>
      </div>

      {/* Selskapsinfo */}
      <Card className="mb-6 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold text-ecit-navy">Selskapsinfo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ecit-navy/50">Type</span>
            <span className="text-ecit-navy">{company.companyType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ecit-navy/50">MVA-registrert</span>
            <span className="text-ecit-navy">{company.vatRegistered ? "Ja" : "Nei"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ecit-navy/50">Ansatte</span>
            <span className="text-ecit-navy">{company.hasEmployees ? "Ja" : "Nei"}</span>
          </div>
          {company.address && (
            <div className="flex justify-between">
              <span className="text-ecit-navy/50">Adresse</span>
              <span className="text-ecit-navy">{company.address}</span>
            </div>
          )}
          {contactList.length > 0 && (
            <>
              <Separator className="my-2 bg-ecit-beige-dark/50" />
              <div className="text-ecit-navy/50">Kontaktpersoner:</div>
              {contactList.map((c) => (
                <div key={c.id} className="flex justify-between">
                  <span className="text-ecit-navy">{c.name}</span>
                  <span className="font-mono text-ecit-navy/50">{c.email}</span>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Regnskapsmodul-lenke */}
      {cycle && (
        <Link
          href={`/rf/kunde/${company.id}/regnskap`}
          className="mb-6 flex items-center justify-between border border-ecit-navy/10 bg-white p-4 shadow-sm transition-colors hover:bg-ecit-beige/30"
        >
          <div>
            <div className="font-semibold text-ecit-navy">Regnskap</div>
            <div className="text-sm text-ecit-navy/50">
              Åpningsbalanse, bokføring, hovedbok og saldobalanse
            </div>
          </div>
          <svg className="h-5 w-5 text-ecit-navy/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Send til godkjenning */}
      {showSendTilGodkjenning && (
        <div className="mb-6">
          <SendTilGodkjenning companyId={company.id} />
        </div>
      )}

      {/* Oppgaver */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ecit-navy">
          Oppgaver{" "}
          <span className="font-mono text-sm font-normal text-ecit-navy/40">
            {levert}/{taskList.length}
          </span>
        </h2>
      </div>

      {taskList.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-8 text-center text-ecit-navy/50">
            Ingen oppgaver generert ennå.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {taskList.map((task) => {
            const taskDocs = docsMap.get(task.id) || [];
            return (
              <Card key={task.id} className="shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ecit-navy">{task.title}</span>
                        <Badge className="bg-ecit-beige font-mono text-xs text-ecit-navy/60">
                          {taskTypeLabel(task.type)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-ecit-navy/50">
                        {task.description}
                      </p>
                      {task.rfComment && task.status === "trenger_mer" && (
                        <p className="mt-2 bg-ecit-ruby/10 p-2 text-sm text-ecit-ruby">
                          RF-kommentar: {task.rfComment}
                        </p>
                      )}
                      {taskDocs.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {taskDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-2 font-mono text-xs text-ecit-navy/40"
                            >
                              <a
                                href={`/api/tasks/${task.id}/documents/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-ecit-blue hover:text-ecit-navy underline"
                              >
                                {doc.originalFilename}
                              </a>
                              <span>
                                ({Math.round(doc.fileSize / 1024)} KB)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {taskStatusBadge(task.status)}
                  </div>
                  {/* RF actions: godkjenn/trenger mer for leverte oppgaver */}
                  <RfTaskActions taskId={task.id} taskStatus={task.status} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
