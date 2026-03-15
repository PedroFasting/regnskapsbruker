"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * RF-komponent for å sende selskapet til godkjenning.
 * Vises kun når kundens opplastingsoppgaver er levert.
 */
export function SendTilGodkjenning({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("message", message);

    try {
      const res = await fetch(`/api/companies/${companyId}/godkjenning`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Kunne ikke sende til godkjenning");
      } else {
        setSuccess(true);
        router.refresh();
      }
    } catch {
      setError("Noe gikk galt");
    } finally {
      setUploading(false);
    }
  }

  if (success) {
    return (
      <Card className="border-ecit-green/30 bg-ecit-green/10">
        <CardContent className="py-4 text-center font-semibold text-ecit-green">
          Sendt til godkjenning! Kunden kan nå se og godkjenne dokumentene.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-bold text-ecit-navy">Send til godkjenning</CardTitle>
        <CardDescription className="text-ecit-navy/50">
          Last opp årsregnskap og/eller generalforsamlingsprotokoll som PDF.
          Kunden vil motta varsel og kan godkjenne digitalt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-ecit-beige-dark bg-ecit-beige/50 p-6 transition-colors hover:bg-ecit-beige">
              <div className="mb-2 flex h-10 w-10 items-center justify-center bg-ecit-navy/10">
                <svg className="h-5 w-5 text-ecit-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-ecit-navy">
                Last opp dokumenter (PDF)
              </p>
              <p className="mt-1 font-mono text-xs text-ecit-navy/40">
                Årsregnskap, generalforsamlingsprotokoll
              </p>
              <input
                type="file"
                name="files"
                multiple
                accept=".pdf"
                className="hidden"
                required
              />
            </label>
          </div>
          <div>
            <Input
              placeholder="Valgfri melding til kunden..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border-ecit-beige-dark focus:border-ecit-blue focus:ring-ecit-blue"
            />
          </div>
          <Button type="submit" className="w-full bg-ecit-navy text-white hover:bg-ecit-navy-dark" disabled={uploading}>
            {uploading ? "Sender..." : "Send til godkjenning"}
          </Button>
          {error && (
            <p className="text-center text-sm text-ecit-ruby">{error}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * RF-komponent for å godkjenne eller avvise en levert oppgave.
 */
export function RfTaskActions({
  taskId,
  taskStatus,
}: {
  taskId: string;
  taskStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");

  if (taskStatus !== "levert") return null;

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);

    if (action === "approve") {
      await fetch(`/api/tasks/${taskId}/rf-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "godkjenn" }),
      });
    } else {
      await fetch(`/api/tasks/${taskId}/rf-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trenger_mer", comment }),
      });
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Button
        size="sm"
        onClick={() => handleAction("approve")}
        disabled={loading}
        className="bg-ecit-green text-white hover:bg-ecit-green/90"
      >
        Godkjenn
      </Button>
      <div className="flex flex-1 gap-2">
        <Input
          placeholder="Kommentar..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-9 border-ecit-beige-dark text-sm focus:border-ecit-blue focus:ring-ecit-blue"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction("reject")}
          disabled={loading || !comment}
          className="border-ecit-beige-dark text-ecit-navy hover:bg-ecit-beige"
        >
          Trenger mer
        </Button>
      </div>
    </div>
  );
}
