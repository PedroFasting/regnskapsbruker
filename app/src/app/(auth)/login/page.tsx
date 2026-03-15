"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(formData: FormData) {
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Feil e-post eller passord");
    } else {
      // Hent session for å finne rolle og redirecte riktig
      const session = await getSession();
      const role = (session?.user as { role?: string })?.role;
      if (role === "rf") {
        router.push("/rf/dashboard");
      } else {
        router.push("/kunde/dashboard");
      }
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Venstre side: ECIT-branding */}
      <div className="hidden w-1/3 bg-ecit-navy lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Regnskapsbruker</h1>
          <p className="mt-1 font-mono text-sm text-ecit-blue-light">by ECIT</p>
        </div>
        <div>
          <p className="text-lg font-light leading-relaxed text-white/80">
            Smidig samarbeid mellom regnskapsfører og kunde — alt på ett sted.
          </p>
        </div>
        <p className="font-mono text-xs text-white/40">
          ecit.com
        </p>
      </div>

      {/* Høyre side: Innlogging */}
      <div className="flex flex-1 items-center justify-center bg-ecit-cream px-4">
        <div className="w-full max-w-md">
          {/* Mobil-header */}
          <div className="mb-8 lg:hidden">
            <h1 className="text-2xl font-extrabold text-ecit-navy">Regnskapsbruker</h1>
            <p className="font-mono text-sm text-ecit-blue">by ECIT</p>
          </div>

          <Card className="shadow-ecit">
            <CardHeader>
              <CardTitle className="text-2xl font-extrabold text-ecit-navy">Logg inn</CardTitle>
              <CardDescription className="text-ecit-navy/60">
                Logg inn for å se oppgaver og dokumenter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="kunde">
                <TabsList className="grid w-full grid-cols-2 bg-ecit-beige">
                  <TabsTrigger value="kunde" className="data-[state=active]:bg-ecit-navy data-[state=active]:text-white">
                    Kunde
                  </TabsTrigger>
                  <TabsTrigger value="rf" className="data-[state=active]:bg-ecit-navy data-[state=active]:text-white">
                    Regnskapsfører
                  </TabsTrigger>
                </TabsList>

                {/* Kunde: E-post + passord */}
                <TabsContent value="kunde">
                  <form action={handleLogin} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="kunde-email" className="font-semibold text-ecit-navy">E-post</Label>
                      <Input
                        id="kunde-email"
                        name="email"
                        type="email"
                        placeholder="din@epost.no"
                        required
                        className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="kunde-password" className="font-semibold text-ecit-navy">Passord</Label>
                      <Input
                        id="kunde-password"
                        name="password"
                        type="password"
                        required
                        className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-ecit-navy text-white hover:bg-ecit-navy-dark" disabled={loading}>
                      {loading ? "Logger inn..." : "Logg inn"}
                    </Button>
                  </form>
                </TabsContent>

                {/* RF: E-post + passord */}
                <TabsContent value="rf">
                  <form action={handleLogin} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="rf-email" className="font-semibold text-ecit-navy">E-post</Label>
                      <Input
                        id="rf-email"
                        name="email"
                        type="email"
                        placeholder="rf@firma.no"
                        required
                        className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rf-password" className="font-semibold text-ecit-navy">Passord</Label>
                      <Input
                        id="rf-password"
                        name="password"
                        type="password"
                        required
                        className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-ecit-navy text-white hover:bg-ecit-navy-dark" disabled={loading}>
                      {loading ? "Logger inn..." : "Logg inn"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {error && (
                <p className="mt-4 text-center text-sm text-ecit-ruby">{error}</p>
              )}

              <p className="mt-6 text-center text-sm text-ecit-navy/50">
                Er du regnskapsfører?{" "}
                <Link href="/register" className="font-medium text-ecit-blue hover:text-ecit-navy">
                  Registrer deg her
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
