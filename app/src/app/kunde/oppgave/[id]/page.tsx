"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Task {
  id: string;
  title: string;
  description: string;
  helpText: string | null;
  type: string;
  status: string;
  deadlineRelative: string | null;
  rfComment: string | null;
}

interface Document {
  id: string;
  originalFilename: string;
  fileSize: number;
  uploadedAt: string;
  status: string;
}

export default function OppgaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [questionMessage, setQuestionMessage] = useState("");
  const [questionSent, setQuestionSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string>("");

  useEffect(() => {
    params.then(({ id }) => {
      setTaskId(id);
      fetch(`/api/tasks/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.task) setTask(data.task);
          if (data.documents) setDocuments(data.documents);
        });
    });
  }, [params]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    const formData = new FormData();
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        setError(`${file.name} er for stor (maks 25 MB)`);
        setUploading(false);
        return;
      }
      formData.append("files", file);
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Kunne ikke laste opp filen");
      } else {
        const refreshRes = await fetch(`/api/tasks/${taskId}`);
        const data = await refreshRes.json();
        if (data.task) setTask(data.task);
        if (data.documents) setDocuments(data.documents);
      }
    } catch {
      setError("Noe gikk galt ved opplasting");
    } finally {
      setUploading(false);
    }
  }

  async function handleMarkDelivered() {
    try {
      const res = await fetch(`/api/tasks/${taskId}/deliver`, {
        method: "POST",
      });

      if (res.ok) {
        const refreshRes = await fetch(`/api/tasks/${taskId}`);
        const data = await refreshRes.json();
        if (data.task) setTask(data.task);
        router.refresh(); // invalidate server cache so dashboard updates
      }
    } catch {
      setError("Kunne ikke markere som levert");
    }
  }

  async function handleApprove() {
    setError(null);
    setApproving(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Kunne ikke godkjenne oppgaven");
      } else {
        const refreshRes = await fetch(`/api/tasks/${taskId}`);
        const data = await refreshRes.json();
        if (data.task) setTask(data.task);
        router.refresh(); // invalidate server cache so dashboard updates
      }
    } catch {
      setError("Noe gikk galt ved godkjenning");
    } finally {
      setApproving(false);
    }
  }

  async function handleSendQuestion() {
    if (!questionMessage.trim()) return;

    setError(null);
    setSendingQuestion(true);

    try {
      const res = await fetch(`/api/tasks/${taskId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: questionMessage.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Kunne ikke sende spørsmål");
      } else {
        setQuestionSent(true);
        setQuestionMessage("");
        setTimeout(() => {
          setQuestionDialogOpen(false);
          setQuestionSent(false);
        }, 2000);
      }
    } catch {
      setError("Noe gikk galt ved sending av spørsmål");
    } finally {
      setSendingQuestion(false);
    }
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="font-mono text-sm text-ecit-navy/40">Laster...</p>
      </div>
    );
  }

  const isUploadType = task.type === "dokument_opplasting";
  const isGodkjenningType = task.type === "godkjenning";
  const canUpload =
    isUploadType &&
    (task.status === "ikke_startet" || task.status === "trenger_mer");
  const canDeliver =
    !isGodkjenningType &&
    task.status === "ikke_startet" &&
    (isUploadType ? documents.length > 0 : true);
  const canApprove =
    isGodkjenningType &&
    (task.status === "ikke_startet" || task.status === "trenger_mer");

  return (
    <div className="mx-auto max-w-2xl p-8">
      <button
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center gap-1 text-sm text-ecit-blue hover:text-ecit-navy"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tilbake til oppgavelisten
      </button>

      <Card className="mb-6 shadow-ecit">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl font-extrabold text-ecit-navy">{task.title}</CardTitle>
              <CardDescription className="mt-1 text-ecit-navy/50">
                {task.description}
              </CardDescription>
            </div>
            <StatusBadge status={task.status} />
          </div>
        </CardHeader>
        {task.helpText && (
          <CardContent>
            <div className="bg-ecit-blue/10 p-4 text-sm text-ecit-navy">
              <p className="mb-1 font-bold">Tips</p>
              <p>{task.helpText}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* RF-kommentar ved "trenger mer" */}
      {task.status === "trenger_mer" && task.rfComment && (
        <Card className="mb-6 border-ecit-ruby/30 shadow-sm">
          <CardContent className="pt-6">
            <div className="bg-ecit-ruby/10 p-4 text-sm text-ecit-ruby">
              <p className="mb-1 font-bold">Melding fra regnskapsfører</p>
              <p>{task.rfComment}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dokumenter for godkjenningsoppgaver (lastet opp av RF) */}
      {isGodkjenningType && documents.length > 0 && (
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ecit-navy">
              Dokumenter til gjennomgang
            </CardTitle>
            <CardDescription className="text-ecit-navy/50">
              Last ned og les gjennom dokumentene før du godkjenner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map((doc, i) => (
              <div key={doc.id}>
                {i > 0 && <Separator className="my-2 bg-ecit-beige-dark/50" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ecit-navy">
                      {doc.originalFilename}
                    </p>
                    <p className="font-mono text-xs text-ecit-navy/40">
                      {Math.round(doc.fileSize / 1024)} KB
                    </p>
                  </div>
                  <a
                    href={`/api/tasks/${taskId}/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-ecit-blue hover:text-ecit-navy"
                  >
                    Last ned
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Godkjennings-handlinger */}
      {isGodkjenningType && canApprove && (
        <div className="mb-6 space-y-3">
          <Button
            onClick={handleApprove}
            className="w-full bg-ecit-green text-white hover:bg-ecit-green/90"
            size="lg"
            disabled={approving}
          >
            {approving ? "Godkjenner..." : "Godkjenn"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setQuestionDialogOpen(true)}
            className="w-full border-ecit-beige-dark text-ecit-navy hover:bg-ecit-beige"
            size="lg"
          >
            Har spørsmål
          </Button>
        </div>
      )}

      {/* Opplasting (kun for dokument-oppgaver) */}
      {canUpload && (
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ecit-navy">Last opp filer</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-ecit-beige-dark bg-ecit-beige/50 p-8 transition-colors hover:bg-ecit-beige">
              <div className="mb-2 flex h-10 w-10 items-center justify-center bg-ecit-navy/10">
                <svg className="h-5 w-5 text-ecit-navy/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-ecit-navy">
                Dra filer hit eller klikk for å velge
              </p>
              <p className="mt-1 font-mono text-xs text-ecit-navy/40">
                PDF, JPEG, PNG, XLSX, CSV (maks 25 MB)
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {uploading && (
              <p className="mt-2 text-center font-mono text-sm text-ecit-navy/50">
                Laster opp...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Opplastede dokumenter (for dokument-oppgaver) */}
      {isUploadType && documents.length > 0 && (
        <Card className="mb-6 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ecit-navy">
              Opplastede filer ({documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.map((doc, i) => (
              <div key={doc.id}>
                {i > 0 && <Separator className="my-2 bg-ecit-beige-dark/50" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ecit-navy">
                      {doc.originalFilename}
                    </p>
                    <p className="font-mono text-xs text-ecit-navy/40">
                      {Math.round(doc.fileSize / 1024)} KB
                    </p>
                  </div>
                  <DocStatusBadge status={doc.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bekreftelse/lever-knapp (for ikke-godkjenning oppgaver) */}
      {canDeliver && (
        <Button
          onClick={handleMarkDelivered}
          className="w-full bg-ecit-navy text-white hover:bg-ecit-navy-dark"
          size="lg"
        >
          {isUploadType ? "Marker som levert" : "Bekreft"}
        </Button>
      )}

      {/* Statusmeldinger */}
      {task.status === "levert" && !isGodkjenningType && (
        <p className="mt-4 text-center text-sm text-ecit-navy/50">
          Oppgaven er levert og venter på gjennomgang fra regnskapsfører.
        </p>
      )}

      {task.status === "godkjent" && (
        <div className="mt-4 bg-ecit-green/10 p-4 text-center">
          <p className="text-sm font-semibold text-ecit-green">
            {isGodkjenningType
              ? "Du har godkjent dette dokumentet. Godkjenningen er registrert."
              : "Oppgaven er godkjent av regnskapsfører."}
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-ecit-ruby">{error}</p>
      )}

      {/* Spørsmål-dialog */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="border-ecit-beige-dark">
          <DialogHeader>
            <DialogTitle className="font-extrabold text-ecit-navy">Har du spørsmål?</DialogTitle>
            <DialogDescription className="text-ecit-navy/50">
              Send en melding til regnskapsføreren din. De vil svare deg så snart
              som mulig.
            </DialogDescription>
          </DialogHeader>
          {questionSent ? (
            <div className="bg-ecit-green/10 p-4 text-center">
              <p className="text-sm font-semibold text-ecit-green">
                Meldingen er sendt til regnskapsføreren din.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={questionMessage}
                onChange={(e) => setQuestionMessage(e.target.value)}
                placeholder="Skriv spørsmålet ditt her..."
                rows={4}
                className="w-full border border-ecit-beige-dark p-3 text-sm text-ecit-navy placeholder:text-ecit-navy/30 focus:border-ecit-blue focus:outline-none focus:ring-1 focus:ring-ecit-blue"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setQuestionDialogOpen(false)}
                  className="border-ecit-beige-dark text-ecit-navy hover:bg-ecit-beige"
                >
                  Avbryt
                </Button>
                <Button
                  onClick={handleSendQuestion}
                  disabled={
                    sendingQuestion || questionMessage.trim().length === 0
                  }
                  className="bg-ecit-navy text-white hover:bg-ecit-navy-dark"
                >
                  {sendingQuestion ? "Sender..." : "Send spørsmål"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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

function DocStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "lastet_opp":
      return <Badge className="border border-ecit-beige-dark bg-transparent text-ecit-navy/50">Lastet opp</Badge>;
    case "godkjent_av_rf":
      return <Badge className="bg-ecit-green text-white">Godkjent</Badge>;
    case "avvist":
      return <Badge className="bg-ecit-ruby text-white">Avvist</Badge>;
    default:
      return <Badge className="border border-ecit-beige-dark bg-transparent text-ecit-navy/50">{status}</Badge>;
  }
}
