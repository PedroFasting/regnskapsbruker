import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export default async function RfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-ecit-cream">
      <header className="bg-ecit-navy shadow-ecit-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/rf/dashboard" className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-white">Regnskapsbruker</span>
              <span className="hidden font-mono text-xs text-ecit-blue-light sm:inline">RF</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link
                href="/rf/dashboard"
                className="font-light text-white/70 transition-colors hover:text-white"
              >
                Kunder
              </Link>
              <Link
                href="/rf/ny-kunde"
                className="font-light text-white/70 transition-colors hover:text-white"
              >
                Ny kunde
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-white/50 sm:inline">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button
                variant="outline"
                size="sm"
                type="submit"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Logg ut
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
