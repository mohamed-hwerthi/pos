import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Award,
  CheckCircle,
  AlertTriangle,
  Download,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { NF525Attestation as NF525AttestationType } from "@/models/nf525.model";
import { nf525IntegrityService } from "@/services/nf525-integrity.service";
import { nf525ArchiveService } from "@/services/nf525-archive.service";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";
import { sha256 } from "@/utils/nf525-hash";

const COMPLIANCE_FEATURES = [
  "Tickets TVA conformes (art. 286, I-3° bis du CGI)",
  "Chaînage cryptographique SHA-256 des transactions",
  "Numérotation séquentielle inaltérable",
  "Grand total perpétuel",
  "Clôtures périodiques (journalière, mensuelle, annuelle)",
  "Exports conformes JSON et CSV",
  "Journal d'événements cryptographiquement chaîné",
  "Mode intervention technique tracé",
  "Attestation de conformité avec empreinte",
];

const NF525Attestation = () => {
  const navigate = useNavigate();
  const [attestation, setAttestation] = useState<NF525AttestationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [journalValid, setJournalValid] = useState<boolean | null>(null);

  useEffect(() => {
    const generate = async () => {
      setIsLoading(true);
      try {
        const storeRaw = localStorage.getItem("storeInfo");
        const storeInfo = storeRaw
          ? JSON.parse(storeRaw)
          : { name: "EasyPOS Store", siret: "", vatNumber: "", address: "" };

        // Verify chain integrity
        const chain = nf525IntegrityService.getChain();
        let isChainValid = true;
        try {
          const chainResult = await nf525ArchiveService.verifyArchiveIntegrity();
          isChainValid = chainResult.valid;
        } catch {
          isChainValid = chain.length === 0;
        }
        setChainValid(isChainValid);

        // Verify journal integrity
        let isJournalValid = true;
        try {
          const journalResult = await nf525EventJournalService.verifyJournal();
          isJournalValid = journalResult.valid;
        } catch {
          isJournalValid = nf525EventJournalService.getEventCount() === 0;
        }
        setJournalValid(isJournalValid);

        const closings = nf525ArchiveService.getArchiveHistory();
        const journal = nf525EventJournalService.getJournal();

        const integrityStatus = {
          chainValid: isChainValid,
          journalValid: isJournalValid,
          orderCount: chain.length,
          closingsCount: closings.length,
          eventCount: journal.length,
          grandTotal: nf525IntegrityService.getGrandTotal(),
          lastOrderHash: nf525IntegrityService.getLastHash(),
          lastEventDigest: nf525EventJournalService.getLastDigest(),
        };

        // Compute attestation digest
        const digestInput = [
          "EasyPOS",
          "1.0.0",
          storeInfo.name || "",
          storeInfo.siret || "",
          storeInfo.vatNumber || "",
          isChainValid.toString(),
          isJournalValid.toString(),
          chain.length.toString(),
          closings.length.toString(),
          journal.length.toString(),
          nf525IntegrityService.getGrandTotal().toFixed(2),
          nf525IntegrityService.getLastHash(),
          nf525EventJournalService.getLastDigest(),
          new Date().toISOString().split("T")[0],
        ].join("|");

        const attestationDigest = await sha256(digestInput);

        const att: NF525AttestationType = {
          generatedAt: new Date().toISOString(),
          softwareName: "EasyPOS",
          softwareVersion: "1.0.0",
          storeInfo: {
            name: storeInfo.name || "EasyPOS Store",
            siret: storeInfo.siret || "",
            vatNumber: storeInfo.vatNumber || "",
            address: storeInfo.address || "",
          },
          complianceFeatures: COMPLIANCE_FEATURES,
          integrityStatus,
          attestationDigest,
        };

        setAttestation(att);
      } catch (error) {
        console.error("NF525: erreur génération attestation", error);
      } finally {
        setIsLoading(false);
      }
    };

    generate();
  }, []);

  const handleDownload = () => {
    if (!attestation) return;

    const text = `
================================================================
        ATTESTATION DE CONFORMITÉ NF525
        Logiciel de caisse certifié
================================================================

Date de génération : ${new Date(attestation.generatedAt).toLocaleString("fr-FR")}

────────────────────────────────────────────────────────────────
  INFORMATIONS LOGICIEL
────────────────────────────────────────────────────────────────
Nom du logiciel    : ${attestation.softwareName}
Version            : ${attestation.softwareVersion}
Établissement      : ${attestation.storeInfo.name}
SIRET              : ${attestation.storeInfo.siret || "Non renseigné"}
N° TVA             : ${attestation.storeInfo.vatNumber || "Non renseigné"}
Adresse            : ${attestation.storeInfo.address || "Non renseignée"}

────────────────────────────────────────────────────────────────
  DÉCLARATION DE CONFORMITÉ
────────────────────────────────────────────────────────────────
Le présent logiciel de caisse est conforme aux dispositions de
l'article 286, I-3° bis du Code général des impôts relatives
aux conditions d'inaltérabilité, de sécurisation, de
conservation et d'archivage des données en vue du contrôle de
l'administration fiscale, telles que précisées par le cahier
des charges NF525.

────────────────────────────────────────────────────────────────
  FONCTIONNALITÉS CONFORMES
────────────────────────────────────────────────────────────────
${attestation.complianceFeatures.map((f) => `  [OK] ${f}`).join("\n")}

────────────────────────────────────────────────────────────────
  ÉTAT D'INTÉGRITÉ
────────────────────────────────────────────────────────────────
Chaîne de transactions : ${attestation.integrityStatus.chainValid ? "INTÈGRE" : "COMPROMISE"}
Journal d'événements   : ${attestation.integrityStatus.journalValid ? "INTÈGRE" : "COMPROMIS"}
Nombre de tickets      : ${attestation.integrityStatus.orderCount}
Nombre de clôtures     : ${attestation.integrityStatus.closingsCount}
Nombre d'événements    : ${attestation.integrityStatus.eventCount}
Grand total perpétuel  : ${attestation.integrityStatus.grandTotal.toFixed(2)} EUR
Dernier hash ticket    : ${attestation.integrityStatus.lastOrderHash.slice(0, 32).toUpperCase()}...
Dernier digest journal : ${attestation.integrityStatus.lastEventDigest.slice(0, 32).toUpperCase()}...

────────────────────────────────────────────────────────────────
  EMPREINTE DE L'ATTESTATION
────────────────────────────────────────────────────────────────
SHA-256 : ${attestation.attestationDigest.toUpperCase()}

================================================================
  Document généré automatiquement par ${attestation.softwareName} v${attestation.softwareVersion}
  Ce document fait foi pour le contrôle fiscal.
================================================================
`.trim();

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attestation-nf525-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!attestation) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-muted-foreground">Impossible de générer l'attestation.</p>
          <Button variant="ghost" onClick={() => navigate("/nf525-archive")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/nf525-archive")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Attestation de Conformité NF525</h1>
          </div>
        </div>

        {/* Software Info */}
        <Card className="p-5 mb-4">
          <h2 className="text-lg font-semibold mb-3">Informations logiciel</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Logiciel :</span>{" "}
              <span className="font-semibold">{attestation.softwareName} v{attestation.softwareVersion}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Établissement :</span>{" "}
              <span className="font-semibold">{attestation.storeInfo.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SIRET :</span>{" "}
              <span className="font-semibold">{attestation.storeInfo.siret || "Non renseigné"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">N° TVA :</span>{" "}
              <span className="font-semibold">{attestation.storeInfo.vatNumber || "Non renseigné"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Adresse :</span>{" "}
              <span className="font-semibold">{attestation.storeInfo.address || "Non renseignée"}</span>
            </div>
          </div>
        </Card>

        {/* Legal Declaration */}
        <Card className="p-5 mb-4">
          <h2 className="text-lg font-semibold mb-3">Déclaration de conformité</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Le présent logiciel de caisse est conforme aux dispositions de l'article 286, I-3° bis
            du Code général des impôts relatives aux conditions d'inaltérabilité, de sécurisation,
            de conservation et d'archivage des données en vue du contrôle de l'administration
            fiscale, telles que précisées par le cahier des charges NF525.
          </p>
        </Card>

        {/* Compliance Features */}
        <Card className="p-5 mb-4">
          <h2 className="text-lg font-semibold mb-3">Fonctionnalités conformes</h2>
          <ul className="space-y-2">
            {attestation.complianceFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </Card>

        {/* Integrity Status */}
        <Card className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">État d'intégrité</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Chaîne :</span>
              {chainValid ? (
                <span className="flex items-center gap-1 text-green-700 font-semibold">
                  <CheckCircle className="h-4 w-4" /> INTÈGRE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-700 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> COMPROMISE
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Journal :</span>
              {journalValid ? (
                <span className="flex items-center gap-1 text-green-700 font-semibold">
                  <CheckCircle className="h-4 w-4" /> INTÈGRE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-700 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> COMPROMIS
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Tickets :</span>{" "}
              <span className="font-semibold">{attestation.integrityStatus.orderCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Clôtures :</span>{" "}
              <span className="font-semibold">{attestation.integrityStatus.closingsCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Événements :</span>{" "}
              <span className="font-semibold">{attestation.integrityStatus.eventCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Grand total :</span>{" "}
              <span className="font-semibold">{attestation.integrityStatus.grandTotal.toFixed(2)} €</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Dernier hash :</span>{" "}
              <span className="font-mono text-xs">
                {attestation.integrityStatus.lastOrderHash.slice(0, 32).toUpperCase()}...
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Dernier digest journal :</span>{" "}
              <span className="font-mono text-xs">
                {attestation.integrityStatus.lastEventDigest.slice(0, 32).toUpperCase()}...
              </span>
            </div>
          </div>
        </Card>

        {/* Attestation Digest */}
        <Card className="p-5 mb-6">
          <h2 className="text-lg font-semibold mb-2">Empreinte de l'attestation</h2>
          <p className="font-mono text-sm break-all bg-muted p-3 rounded">
            SHA-256 : {attestation.attestationDigest.toUpperCase()}
          </p>
        </Card>

        {/* Download */}
        <Button size="lg" className="w-full" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Télécharger l'attestation
        </Button>
      </div>
    </div>
  );
};

export default NF525Attestation;
