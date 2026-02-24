import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Archive,
  Download,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Loader2,
  BookOpen,
  Wrench,
  Award,
  Cloud,
} from "lucide-react";
import { NF525PeriodicClosing, NF525PeriodicClosingType } from "@/models/nf525.model";
import { nf525ArchiveService } from "@/services/nf525-archive.service";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";
import { nf525SyncService } from "@/services/nf525-sync.service";
import NF525EventJournal from "@/components/NF525EventJournal";
import NF525SyncStatus from "@/components/NF525SyncStatus";
import TechnicalInterventionModal from "@/components/TechnicalInterventionModal";

const TYPE_LABELS: Record<NF525PeriodicClosingType, string> = {
  daily: "Journalier",
  monthly: "Mensuel",
  yearly: "Annuel",
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \u20ac";

type ArchiveTab = NF525PeriodicClosingType | "journal";

const NF525Archive = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ArchiveTab>("daily");
  const [closings, setClosings] = useState<NF525PeriodicClosing[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    errors: string[];
    checkedClosings: number;
  } | null>(null);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [interventionActive, setInterventionActive] = useState(
    nf525EventJournalService.isInterventionMode()
  );
  const [isVerifyingServer, setIsVerifyingServer] = useState(false);
  const [serverVerificationResult, setServerVerificationResult] = useState<{
    chain: { valid: boolean; checkedCount: number; errors: string[] } | null;
    closings: { valid: boolean; checkedCount: number; errors: string[] } | null;
    journal: { valid: boolean; checkedCount: number; errors: string[] } | null;
  } | null>(null);

  const loadClosings = useCallback(() => {
    if (activeTab !== "journal") {
      setClosings(nf525ArchiveService.getClosingsByType(activeTab));
    }
  }, [activeTab]);

  useEffect(() => {
    loadClosings();
    setVerificationResult(null);
  }, [loadClosings]);

  const handleGenerate = async () => {
    if (activeTab === "journal") return;
    setIsGenerating(true);
    try {
      switch (activeTab) {
        case "daily":
          await nf525ArchiveService.generateDailyClosing();
          break;
        case "monthly":
          await nf525ArchiveService.generateMonthlyClosing();
          break;
        case "yearly":
          await nf525ArchiveService.generateYearlyClosing();
          break;
      }
      loadClosings();
      // Background sync to backend
      nf525SyncService.syncAll().catch(() => {});
    } catch (error: any) {
      alert(error.message || "Erreur lors de la génération de la clôture");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await nf525ArchiveService.verifyArchiveIntegrity();
      setVerificationResult(result);
    } catch {
      setVerificationResult({
        valid: false,
        errors: ["Erreur lors de la vérification"],
        checkedClosings: 0,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyServer = async () => {
    setIsVerifyingServer(true);
    try {
      // Sync first, then verify on server
      await nf525SyncService.syncAll();
      const [chain, closings, journal] = await Promise.all([
        nf525SyncService.verifyChainOnServer(),
        nf525SyncService.verifyClosingsOnServer(),
        nf525SyncService.verifyJournalOnServer(),
      ]);
      setServerVerificationResult({ chain, closings, journal });
    } catch (e: any) {
      setServerVerificationResult({
        chain: { valid: false, checkedCount: 0, errors: [e.message || "Erreur serveur"] },
        closings: null,
        journal: null,
      });
    } finally {
      setIsVerifyingServer(false);
    }
  };

  const handleExportJSON = async () => {
    await nf525ArchiveService.downloadJSON();
    try {
      const chain = (await import("@/services/nf525-integrity.service")).nf525IntegrityService.getChain();
      await nf525EventJournalService.logArchiveExported({
        format: "JSON",
        fileName: `nf525-archive-${new Date().toISOString().split("T")[0]}.json`,
        recordCount: chain.length,
      });
    } catch (e) { console.warn("NF525: journal ARCHIVE_EXPORTED", e); }
  };

  const handleExportCSV = async () => {
    nf525ArchiveService.downloadCSV();
    try {
      const chain = (await import("@/services/nf525-integrity.service")).nf525IntegrityService.getChain();
      await nf525EventJournalService.logArchiveExported({
        format: "CSV",
        fileName: `nf525-export-fiscal-${new Date().toISOString().split("T")[0]}.csv`,
        recordCount: chain.length,
      });
    } catch (e) { console.warn("NF525: journal ARCHIVE_EXPORTED", e); }
  };

  // Status summary
  const allClosings = nf525ArchiveService.getArchiveHistory();
  const todayStr = new Date().toISOString().split("T")[0];
  const monthStr = todayStr.slice(0, 7);
  const yearStr = todayStr.slice(0, 4);

  const hasTodayClosing = nf525ArchiveService.hasClosingForPeriod("daily", todayStr);
  const dailyCountThisMonth = allClosings.filter(
    (c) => c.type === "daily" && c.periodIdentifier.startsWith(monthStr)
  ).length;
  const monthlyCountThisYear = allClosings.filter(
    (c) => c.type === "monthly" && c.periodIdentifier.startsWith(yearStr)
  ).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Intervention active banner */}
        {interventionActive && (
          <div className="mb-4 p-3 rounded-lg bg-orange-100 border border-orange-300 flex items-center gap-2 text-orange-800">
            <Wrench className="h-5 w-5" />
            <span className="font-semibold">Mode intervention technique actif</span>
            <span className="text-sm">— Toutes les opérations sont tracées comme intervention</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/pos")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au POS
            </Button>
            <div className="flex items-center gap-2">
              <Archive className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Archivage NF525</h1>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Aujourd'hui ({todayStr}):</span>
              {hasTodayClosing ? (
                <Badge variant="default" className="bg-green-600">Clôturée</Badge>
              ) : (
                <Badge variant="secondary">En attente</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Mois en cours:</span>
              <span className="font-semibold">{dailyCountThisMonth} clôtures journalières</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Année:</span>
              <span className="font-semibold">{monthlyCountThisYear}/12 clôtures mensuelles</span>
            </div>
          </div>
        </Card>

        {/* Sync Status */}
        <div className="mb-6">
          <NF525SyncStatus />
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ArchiveTab)}
          className="mb-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="daily">Journalier</TabsTrigger>
            <TabsTrigger value="monthly">Mensuel</TabsTrigger>
            <TabsTrigger value="yearly">Annuel</TabsTrigger>
            <TabsTrigger value="journal">
              <BookOpen className="h-4 w-4 mr-1" />
              Journal
            </TabsTrigger>
          </TabsList>

          {(["daily", "monthly", "yearly"] as NF525PeriodicClosingType[]).map((type) => (
            <TabsContent key={type} value={type}>
              {/* History */}
              <div className="space-y-3 mb-6">
                <h2 className="text-lg font-semibold">
                  Historique — {TYPE_LABELS[type]}
                </h2>

                {closings.length === 0 ? (
                  <Card className="p-6 text-center text-muted-foreground">
                    Aucune clôture {TYPE_LABELS[type].toLowerCase()} enregistrée
                  </Card>
                ) : (
                  closings.map((closing) => (
                    <Card key={closing.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">
                              Clôture du {closing.periodIdentifier}
                            </span>
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Valide
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>
                              {closing.orderCount} tickets | GT:{" "}
                              {formatCurrency(closing.perpetualGrandTotal)}
                            </p>
                            <p>
                              TTC: {formatCurrency(closing.totalTTC)} | HT:{" "}
                              {formatCurrency(closing.totalHT)} | TVA:{" "}
                              {formatCurrency(closing.totalVAT)}
                            </p>
                            <p>
                              Séq #{closing.firstSequentialNumber}-#
                              {closing.lastSequentialNumber} | Digest:{" "}
                              <span className="font-mono">
                                {closing.digest.slice(0, 16).toUpperCase()}...
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(closing.createdAt).toLocaleString("fr-FR")}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          ))}

          <TabsContent value="journal">
            <NF525EventJournal />
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Actions</h2>
          <div className="flex flex-wrap gap-3">
            {activeTab !== "journal" && (
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 mr-2" />
                )}
                Générer clôture {TYPE_LABELS[activeTab as NF525PeriodicClosingType]?.toLowerCase()}
              </Button>
            )}
            <Button variant="outline" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <FileText className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleVerify} disabled={isVerifying}>
              {isVerifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Vérifier (local)
            </Button>
            <Button variant="outline" onClick={handleVerifyServer} disabled={isVerifyingServer}>
              {isVerifyingServer ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4 mr-2" />
              )}
              Vérifier (serveur)
            </Button>
            <Button
              variant="outline"
              className={interventionActive ? "border-orange-400 text-orange-700 bg-orange-50" : ""}
              onClick={() => setInterventionModalOpen(true)}
            >
              <Wrench className="h-4 w-4 mr-2" />
              {interventionActive ? "Intervention en cours" : "Mode Intervention"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/nf525-attestation")}>
              <Award className="h-4 w-4 mr-2" />
              Attestation
            </Button>
          </div>
        </Card>

        {/* Verification result banner */}
        {verificationResult && (
          <Card
            className={`p-4 ${
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
                    ? "Archives intègres"
                    : "Erreurs détectées dans les archives"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {verificationResult.checkedClosings} clôtures vérifiées
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
        {/* Server Verification Result */}
        {serverVerificationResult && (
          <Card className="p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Vérification serveur</h3>
            </div>
            <div className="space-y-2">
              {(["chain", "closings", "journal"] as const).map((key) => {
                const v = serverVerificationResult[key];
                if (!v) return null;
                const labels = { chain: "Chaîne", closings: "Clôtures", journal: "Journal" };
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 text-sm">
                      {v.valid ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">
                        {labels[key]}: {v.valid ? "intègre" : "erreurs détectées"}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        ({v.checkedCount} vérifiés)
                      </span>
                    </div>
                    {!v.valid && v.errors.length > 0 && (
                      <ul className="ml-6 mt-1 text-xs text-red-600 list-disc list-inside">
                        {v.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Technical Intervention Modal */}
      <TechnicalInterventionModal
        isOpen={interventionModalOpen}
        onClose={() => setInterventionModalOpen(false)}
        onModeChange={(active) => setInterventionActive(active)}
        currentlyActive={interventionActive}
      />
    </div>
  );
};

export default NF525Archive;
