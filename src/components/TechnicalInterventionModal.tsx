import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Wrench, X } from "lucide-react";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";

interface TechnicalInterventionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModeChange: (active: boolean) => void;
  currentlyActive: boolean;
}

const TechnicalInterventionModal = ({
  isOpen,
  onClose,
  onModeChange,
  currentlyActive,
}: TechnicalInterventionModalProps) => {
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleStart = async () => {
    if (!reason.trim()) return;
    setIsProcessing(true);
    try {
      await nf525EventJournalService.logTechnicalInterventionStart(reason.trim());
      onModeChange(true);
      setReason("");
      onClose();
    } catch (e) {
      console.error("NF525: erreur début intervention", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnd = async () => {
    setIsProcessing(true);
    try {
      await nf525EventJournalService.logTechnicalInterventionEnd();
      onModeChange(false);
      onClose();
    } catch (e) {
      console.error("NF525: erreur fin intervention", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            <h2 className="text-lg font-bold">Intervention technique</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          {currentlyActive ? (
            <>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 mb-6">
                <div className="flex items-center gap-2 text-orange-800 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Mode intervention actif
                </div>
                <p className="text-sm text-orange-700">
                  Toutes les opérations sont marquées comme effectuées en mode intervention technique.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleEnd}
                disabled={isProcessing}
              >
                {isProcessing ? "Traitement..." : "Terminer l'intervention"}
              </Button>
            </>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 mb-4">
                <div className="flex items-center gap-2 text-orange-800 font-semibold mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Attention
                </div>
                <p className="text-sm text-orange-700">
                  Le mode intervention technique sera tracé dans le journal d'audit NF525.
                  Toutes les opérations effectuées pendant l'intervention seront marquées.
                </p>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">
                  Raison de l'intervention
                </label>
                <Textarea
                  placeholder="Décrivez la raison de l'intervention technique..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                onClick={handleStart}
                disabled={!reason.trim() || isProcessing}
              >
                {isProcessing ? "Traitement..." : "Démarrer l'intervention"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TechnicalInterventionModal;
