import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export default async function KundeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-ecit-cream">
      <header className="bg-ecit-navy shadow-ecit-header">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/kunde/dashboard" className="flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-white">Regnskapsbruker</span>
            <span className="hidden font-mono text-xs text-ecit-green sm:inline">Kunde</span>
          </Link>
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
