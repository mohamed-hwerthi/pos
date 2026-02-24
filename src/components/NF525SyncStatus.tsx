import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Cloud,
  CloudOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import { NF525SyncResult } from "@/models/nf525.model";
import { nf525SyncService } from "@/services/nf525-sync.service";

const NF525SyncStatus = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<NF525SyncResult | null>(null);
  const [pending, setPending] = useState({ chain: 0, closings: 0, sessions: 0, events: 0, total: 0 });
  const [expanded, setExpanded] = useState(false);
  const [serverVerification, setServerVerification] = useState<{
    chain?: { valid: boolean; checkedCount: number; errors: string[] };
    closings?: { valid: boolean; checkedCount: number; errors: string[] };
    journal?: { valid: boolean; checkedCount: number; errors: string[] };
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const refreshPending = useCallback(() => {
    setPending(nf525SyncService.getPendingCounts());
    const state = nf525SyncService.getSyncState();
    setLastResult(state.lastSyncResult);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await nf525SyncService.syncAll();
      setLastResult(result);
      refreshPending();
    } catch (e: any) {
      setLastResult({
        success: false,
        syncedChain: 0,
        syncedClosings: 0,
        syncedSessions: 0,
        syncedEvents: 0,
        errors: [e.message || "Erreur de synchronisation"],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleServerVerify = async () => {
    setIsVerifying(true);
    try {
      const [chain, closings, journal] = await Promise.all([
        nf525SyncService.verifyChainOnServer(),
        nf525SyncService.verifyClosingsOnServer(),
        nf525SyncService.verifyJournalOnServer(),
      ]);
      setServerVerification({ chain, closings, journal });
    } catch (e: any) {
      setServerVerification({
        chain: { valid: false, checkedCount: 0, errors: [e.message || "Erreur"] },
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const totalSynced = lastResult
    ? lastResult.syncedChain + lastResult.syncedClosings + lastResult.syncedSessions + lastResult.syncedEvents
    : 0;

  const syncProgress = pending.total > 0 ? 0 : 100;

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {pending.total === 0 ? (
            <Cloud className="h-5 w-5 text-green-600" />
          ) : (
            <CloudOff className="h-5 w-5 text-orange-500" />
          )}
          <h3 className="font-semibold text-sm">Synchronisation Backend</h3>
          {pending.total === 0 ? (
            <Badge variant="default" className="bg-green-600 text-xs">
              Synchronisé
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              {pending.total} en attente
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExpanded(!expanded)}
            className="h-7 px-2"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-7"
          >
            {isSyncing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {isSyncing ? "Sync..." : "Synchroniser"}
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={syncProgress} className="h-1.5 mb-2" />

      {/* Pending breakdown */}
      {pending.total > 0 && (
        <div className="flex gap-3 text-xs text-muted-foreground mb-2">
          {pending.chain > 0 && <span>Chaîne: {pending.chain}</span>}
          {pending.closings > 0 && <span>Clôtures: {pending.closings}</span>}
          {pending.sessions > 0 && <span>Sessions: {pending.sessions}</span>}
          {pending.events > 0 && <span>Événements: {pending.events}</span>}
        </div>
      )}

      {/* Last sync result */}
      {lastResult && (
        <div className="flex items-center gap-2 text-xs">
          {lastResult.success ? (
            <CheckCircle className="h-3 w-3 text-green-600" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-red-500" />
          )}
          <span className="text-muted-foreground">
            Dernière sync:{" "}
            {new Date(lastResult.timestamp).toLocaleString("fr-FR")}
            {totalSynced > 0 && ` — ${totalSynced} élément(s) envoyé(s)`}
          </span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Last result details */}
          {lastResult && (
            <div className="text-xs space-y-1">
              <p className="font-medium">Détails dernière synchronisation:</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Chaîne: {lastResult.syncedChain} envoyé(s)</span>
                <span>Clôtures: {lastResult.syncedClosings} envoyé(s)</span>
                <span>Sessions: {lastResult.syncedSessions} envoyé(s)</span>
                <span>Événements: {lastResult.syncedEvents} envoyé(s)</span>
              </div>
              {lastResult.errors.length > 0 && (
                <div className="mt-1">
                  <p className="text-red-600 font-medium">Erreurs:</p>
                  <ul className="list-disc list-inside text-red-500">
                    {lastResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Server verification */}
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleServerVerify}
              disabled={isVerifying}
              className="h-7 mb-2"
            >
              {isVerifying ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ShieldCheck className="h-3 w-3 mr-1" />
              )}
              Vérifier intégrité serveur
            </Button>

            {serverVerification && (
              <div className="text-xs space-y-1">
                {(["chain", "closings", "journal"] as const).map((key) => {
                  const v = serverVerification[key];
                  if (!v) return null;
                  const label = { chain: "Chaîne", closings: "Clôtures", journal: "Journal" }[key];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {v.valid ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      <span>
                        {label}: {v.valid ? "intègre" : "erreurs détectées"} ({v.checkedCount} vérifiés)
                      </span>
                    </div>
                  );
                })}
                {serverVerification.chain && !serverVerification.chain.valid && (
                  <ul className="list-disc list-inside text-red-500 ml-5">
                    {serverVerification.chain.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default NF525SyncStatus;
