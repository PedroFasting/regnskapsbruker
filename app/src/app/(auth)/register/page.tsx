"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(formData: FormData) {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          firmName: formData.get("firmName"),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke opprette konto");
      } else {
        router.push("/login?registered=true");
      }
    } catch {
      setError("Noe gikk galt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ecit-cream px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold text-ecit-navy">Regnskapsbruker</h1>
          <p className="font-mono text-sm text-ecit-blue">by ECIT</p>
        </div>

        <Card className="shadow-ecit">
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold text-ecit-navy">Registrer deg</CardTitle>
            <CardDescription className="text-ecit-navy/60">
              Opprett en regnskapsførerkonto for å komme i gang
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold text-ecit-navy">Navn</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ditt navn"
                  required
                  className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold text-ecit-navy">E-post</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="rf@firma.no"
                  required
                  className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firmName" className="font-semibold text-ecit-navy">Firmanavn</Label>
                <Input
                  id="firmName"
                  name="firmName"
                  placeholder="Ditt regnskapsbyrå"
                  className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-semibold text-ecit-navy">Passord</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minst 8 tegn"
                  required
                  minLength={8}
                  className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
                />
              </div>
              <Button type="submit" className="w-full bg-ecit-navy text-white hover:bg-ecit-navy-dark" disabled={loading}>
                {loading ? "Oppretter..." : "Opprett konto"}
              </Button>
            </form>

            {error && (
              <p className="mt-4 text-center text-sm text-ecit-ruby">{error}</p>
            )}

            <p className="mt-6 text-center text-sm text-ecit-navy/50">
              Har du allerede en konto?{" "}
              <Link href="/login" className="font-medium text-ecit-blue hover:text-ecit-navy">
                Logg inn
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
