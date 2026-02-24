import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  AlertTriangle,
  Download,
  Loader2,
  CheckCircle,
  Wrench,
} from "lucide-react";
import { NF525AuditEvent, NF525EventType } from "@/models/nf525.model";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";

const EVENT_LABELS: Record<NF525EventType, string> = {
  ORDER_CREATED: "Commande créée",
  SESSION_OPENED: "Session ouverte",
  SESSION_CLOSED: "Session fermée",
  DAILY_CLOSING: "Clôture journalière",
  MONTHLY_CLOSING: "Clôture mensuelle",
  YEARLY_CLOSING: "Clôture annuelle",
  CHAIN_VERIFIED: "Chaîne vérifiée",
  ARCHIVE_EXPORTED: "Archive exportée",
  TECHNICAL_INTERVENTION_START: "Intervention technique (début)",
  TECHNICAL_INTERVENTION_END: "Intervention technique (fin)",
};

const EVENT_COLORS: Record<NF525EventType, string> = {
  ORDER_CREATED: "bg-blue-100 text-blue-800",
  SESSION_OPENED: "bg-green-100 text-green-800",
  SESSION_CLOSED: "bg-red-100 text-red-800",
  DAILY_CLOSING: "bg-purple-100 text-purple-800",
  MONTHLY_CLOSING: "bg-purple-100 text-purple-800",
  YEARLY_CLOSING: "bg-purple-100 text-purple-800",
  CHAIN_VERIFIED: "bg-teal-100 text-teal-800",
  ARCHIVE_EXPORTED: "bg-gray-100 text-gray-800",
  TECHNICAL_INTERVENTION_START: "bg-orange-100 text-orange-800",
  TECHNICAL_INTERVENTION_END: "bg-orange-100 text-orange-800",
};

function summarizeDetails(event: NF525AuditEvent): string {
  const d = event.details;
  switch (event.eventType) {
    case "ORDER_CREATED":
      return `#${d.orderNumber} | ${d.total} € | ${d.paymentMethod}`;
    case "SESSION_OPENED":
      return `Session ${d.sessionNumber} | Fond: ${d.initialAmount} €`;
    case "SESSION_CLOSED":
      return `Session ${d.sessionNumber} | Ventes: ${d.totalSales} € | Écart: ${d.cashDifference} €`;
    case "DAILY_CLOSING":
    case "MONTHLY_CLOSING":
    case "YEARLY_CLOSING":
      return `${d.periodIdentifier} | ${d.orderCount} tickets | ${d.totalTTC} €`;
    case "CHAIN_VERIFIED":
      return `${d.valid ? "Intègre" : "Erreurs"} | ${d.checkedCount} vérifiés | ${d.errorCount} erreur(s)`;
    case "ARCHIVE_EXPORTED":
      return `${d.format} | ${d.fileName} | ${d.recordCount} enregistrements`;
    case "TECHNICAL_INTERVENTION_START":
      return `Raison: ${d.reason}`;
    case "TECHNICAL_INTERVENTION_END":
      return "Fin de l'intervention";
    default:
      return JSON.stringify(d);
  }
}

const NF525EventJournal = () => {
  const [journal, setJournal] = useState<NF525AuditEvent[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    checkedCount: number;
    errors: string[];
  } | null>(null);

  const loadJournal = useCallback(() => {
    const events = nf525EventJournalService.getJournal();
    setJournal([...events].reverse());
  }, []);

  useEffect(() => {
    loadJournal();
  }, [loadJournal]);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await nf525EventJournalService.verifyJournal();
      setVerificationResult(result);
    } catch {
      setVerificationResult({
        valid: false,
        checkedCount: 0,
        errors: ["Erreur lors de la vérification"],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExport = () => {
    const content = nf525EventJournalService.exportJournalJSON();
    const today = new Date().toISOString().split("T")[0];
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nf525-journal-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 mb-4">
        <Button variant="outline" onClick={handleVerify} disabled={isVerifying}>
          {isVerifying ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Vérifier le journal
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exporter le journal
        </Button>
        <span className="text-sm text-muted-foreground self-center">
          {journal.length} événement(s)
        </span>
      </div>

      {verificationResult && (
        <Card
          className={`p-4 mb-4 ${
            verificationResult.valid
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.valid ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div>
              <p
                className={`font-semibold ${
                  verificationResult.valid ? "text-green-800" : "text-red-800"
                }`}
              >
                {verificationResult.valid
                  ? "Journal intègre"
                  : "Altération détectée dans le journal"}
              </p>
              <p className="text-sm text-muted-foreground">
                {verificationResult.checkedCount} événements vérifiés
              </p>
              {verificationResult.errors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {verificationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      {journal.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          Aucun événement enregistré
        </Card>
      ) : (
        <div className="space-y-2">
          {journal.map((event) => (
            <Card key={event.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge
                      variant="secondary"
                      className={EVENT_COLORS[event.eventType]}
                    >
                      {EVENT_LABELS[event.eventType]}
                    </Badge>
                    {event.technicalIntervention && (
                      <Badge
                        variant="secondary"
                        className="bg-orange-200 text-orange-900"
                      >
                        <Wrench className="h-3 w-3 mr-1" />
                        Intervention
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      #{event.sequentialNumber}
                    </span>
                  </div>
                  <p className="text-sm truncate">
                    {summarizeDetails(event)}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{event.actor.cashierName}</span>
                    <span>
                      {new Date(event.timestamp).toLocaleString("fr-FR")}
                    </span>
                    <span className="font-mono">
                      {event.digest.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NF525EventJournal;
