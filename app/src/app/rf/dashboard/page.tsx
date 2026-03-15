import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { companies, accountants, cycles, tasks } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function statusBadge(levert: number, totalt: number) {
  if (levert === 0) {
    return <Badge className="bg-ecit-ruby text-white">Ikke startet</Badge>;
  }
  if (levert >= totalt) {
    return <Badge className="bg-ecit-green text-white">Ferdig</Badge>;
  }
  return <Badge className="bg-ecit-beige text-ecit-navy">{levert} av {totalt}</Badge>;
}

export default async function RfDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Finn accountant-rad for innlogget bruker
  const [accountant] = await db
    .select()
    .from(accountants)
    .where(eq(accountants.userId, session.user.id))
    .limit(1);

  if (!accountant) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="mb-4 text-2xl font-extrabold text-ecit-navy">Dashboard</h1>
        <p className="text-ecit-navy/50">
          Kunne ikke finne regnskapsførerprofilen din. Kontakt administrator.
        </p>
      </div>
    );
  }

  // Hent alle selskaper for denne RF
  const companyList = await db
    .select()
    .from(companies)
    .where(eq(companies.accountantId, accountant.id));

  // Hent oppgavestatistikk per selskap
  const companiesWithStats = await Promise.all(
    companyList.map(async (company) => {
      // Finn aktiv syklus
      const [cycle] = await db
        .select()
        .from(cycles)
        .where(
          and(eq(cycles.companyId, company.id), eq(cycles.status, "aktiv"))
        )
        .limit(1);

      if (!cycle) {
        return { ...company, year: null, totalTasks: 0, deliveredTasks: 0 };
      }

      // Tell oppgaver
      const [taskStats] = await db
        .select({ total: count() })
        .from(tasks)
        .where(eq(tasks.cycleId, cycle.id));

      const [deliveredStats] = await db
        .select({ total: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.cycleId, cycle.id),
            eq(tasks.status, "levert")
          )
        );

      const [approvedStats] = await db
        .select({ total: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.cycleId, cycle.id),
            eq(tasks.status, "godkjent")
          )
        );

      return {
        ...company,
        year: cycle.year,
        totalTasks: taskStats.total,
        deliveredTasks: deliveredStats.total + approvedStats.total,
      };
    })
  );

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ecit-navy">Mine kunder</h1>
          <p className="font-mono text-sm text-ecit-navy/50">
            {companyList.length} selskap{companyList.length !== 1 ? "er" : ""}
          </p>
        </div>
        <Link href="/rf/ny-kunde">
          <Button className="bg-ecit-navy text-white hover:bg-ecit-navy-dark">
            Legg til ny kunde
          </Button>
        </Link>
      </div>

      {companiesWithStats.length === 0 ? (
        <Card className="shadow-ecit">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center bg-ecit-beige">
              <svg className="h-8 w-8 text-ecit-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="mb-4 text-ecit-navy/50">
              Du har ingen kunder ennå.
            </p>
            <Link href="/rf/ny-kunde">
              <Button className="bg-ecit-navy text-white hover:bg-ecit-navy-dark">
                Legg til din første kunde
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {companiesWithStats.map((company) => (
            <Link
              key={company.id}
              href={`/rf/kunde/${company.id}`}
              className="block"
            >
              <Card className="border-ecit-beige-dark/50 shadow-sm transition-all hover:shadow-ecit hover:border-ecit-blue/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-ecit-navy">{company.name}</CardTitle>
                      <p className="font-mono text-sm text-ecit-navy/40">
                        {company.orgNr}
                        {company.year && <span className="ml-2 font-sans text-ecit-navy/50">Regnskapsår {company.year}</span>}
                      </p>
                    </div>
                    {company.totalTasks > 0 &&
                      statusBadge(company.deliveredTasks, company.totalTasks)}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
