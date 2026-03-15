import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, companies, cycles, tasks } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

function taskStatusBadge(status: string) {
  switch (status) {
    case "ikke_startet":
      return <Badge className="bg-ecit-beige text-ecit-navy">Venter på deg</Badge>;
    case "levert":
      return <Badge className="bg-ecit-blue text-white">Levert</Badge>;
    case "godkjent":
      return <Badge className="bg-ecit-green text-white">Godkjent</Badge>;
    case "trenger_mer":
      return <Badge className="bg-ecit-ruby text-white">Trenger mer info</Badge>;
    default:
      return <Badge className="border border-ecit-beige-dark bg-transparent text-ecit-navy/50">{status}</Badge>;
  }
}

export default async function KundeDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Finn kundens selskaper via contacts-tabellen
  const contactRecords = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, session.user.id));

  if (contactRecords.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="mb-4 text-2xl font-extrabold text-ecit-navy">Mine oppgaver</h1>
        <Card className="shadow-ecit">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center bg-ecit-beige">
              <svg className="h-8 w-8 text-ecit-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-ecit-navy/50">
              Du er ikke koblet til noe selskap ennå. Kontakt din
              regnskapsfører for å bli invitert.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // For MVP: vis første selskap (de fleste kunder har kun ett)
  const contact = contactRecords[0];

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, contact.companyId))
    .limit(1);

  if (!company) redirect("/login");

  // Finn aktiv syklus
  const [cycle] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.companyId, company.id), eq(cycles.status, "aktiv")))
    .limit(1);

  const taskList = cycle
    ? await db
        .select()
        .from(tasks)
        .where(eq(tasks.cycleId, cycle.id))
        .orderBy(asc(tasks.sortOrder))
    : [];

  const ferdig = taskList.filter(
    (t) => t.status === "levert" || t.status === "godkjent"
  ).length;
  const progress = taskList.length > 0 ? (ferdig / taskList.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-ecit-navy">{company.name}</h1>
        <p className="font-mono text-sm text-ecit-navy/40">
          {cycle
            ? `Regnskapsår ${cycle.year}`
            : "Ingen aktiv syklus"}
        </p>
      </div>

      {/* Fremdrift */}
      {taskList.length > 0 && (
        <Card className="mb-8 shadow-sm">
          <CardContent className="py-5">
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-ecit-navy/50">Fremdrift</span>
              <span className="font-semibold text-ecit-navy">
                {ferdig} av {taskList.length} oppgaver
              </span>
            </div>
            <div className="h-2 w-full bg-ecit-beige-dark">
              <div
                className="h-full bg-ecit-green transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Oppgaveliste */}
      <h2 className="mb-4 text-lg font-bold text-ecit-navy">Dine oppgaver</h2>

      {taskList.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="py-8 text-center text-ecit-navy/50">
            Ingen oppgaver ennå. Regnskapsfører setter opp sjekklisten.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {taskList.map((task) => (
            <Link
              key={task.id}
              href={`/kunde/oppgave/${task.id}`}
              className="block"
            >
              <Card className="border-ecit-beige-dark/50 shadow-sm transition-all hover:shadow-ecit hover:border-ecit-blue/30">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-ecit-navy">{task.title}</p>
                      <p className="mt-1 text-sm text-ecit-navy/50">
                        {task.description}
                      </p>
                    </div>
                    {taskStatusBadge(task.status)}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
