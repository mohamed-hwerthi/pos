import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, DollarSign } from "lucide-react";
import { cashierSessionService } from "@/services/cahier-session.service";
import { userService } from "@/services/user.service";
import { nf525EventJournalService } from "@/services/nf525-event-journal.service";
import { UserDTO } from "@/models/user.model";

const CashRegisterOpening = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [initialAmount, setInitialAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserDTO | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Fetch current user on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await userService.getCurrentUser();
        setCurrentUser(user);
        localStorage.setItem(
          "cashier",
          JSON.stringify({
            id: user.id,
            name:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email.split("@")[0],
            email: user.email,
            role: user.role,
          })
        );
      } catch (error: any) {
        console.error("Error fetching current user:", error);
        toast({
          title: "Erreur",
          description:
            "Impossible de récupérer les informations de l'utilisateur",
          variant: "destructive",
        });
        navigate("/login");
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchCurrentUser();
  }, [navigate, toast]);

  const handleOpenRegister = async () => {
    if (!initialAmount || parseFloat(initialAmount) < 0) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un montant valide",
        variant: "destructive",
      });
      return;
    }

    if (!currentUser?.id) {
      toast({
        title: "Erreur",
        description: "Informations du caissier manquantes",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setIsLoading(true);

    try {
      // Create session on the backend
      const sessionResponse = await cashierSessionService.createSession({
        cashierId: currentUser.id,
        openingBalance: parseFloat(initialAmount),
        isClosed: false,
      });

      // Store session data in localStorage for quick access
      const session = {
        id: sessionResponse.id,
        sessionNumber: sessionResponse.sessionNumber,
        cashier:
          currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.email.split("@")[0],
        cashierId: currentUser.id,
        openedAt: sessionResponse.startTime,
        initialAmount: sessionResponse.openingBalance,
        totalSales: sessionResponse.totalSales,
        totalCash: sessionResponse.openingBalance,
        totalCard: 0,
        totalCheck: 0,
        totalTransfer: 0,
        cashMovements: [],
        sales: [],
        status: "open",
      };

      localStorage.setItem("currentSession", JSON.stringify(session));
      localStorage.setItem("cashier", JSON.stringify(currentUser));

      // NF525 Phase 4 : journal SESSION_OPENED
      try {
        await nf525EventJournalService.logSessionOpened({
          sessionId: sessionResponse.id,
          sessionNumber: sessionResponse.sessionNumber || "",
          initialAmount: parseFloat(initialAmount),
        });
      } catch (e) { console.warn('NF525: journal SESSION_OPENED', e); }

      toast({
        title: "Caisse ouverte",
        description: `Session ${
          sessionResponse.sessionNumber
        } - Fond de caisse: ${parseFloat(initialAmount).toFixed(2)} €`,
      });

      navigate("/pos");
    } catch (error: any) {
      console.error("Error creating session:", error);
      toast({
        title: "Erreur",
        description:
          error.response?.data?.message ||
          "Impossible d'ouvrir la caisse. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <DollarSign className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">Ouverture de caisse</h1>
          <p className="text-muted-foreground">
            Bienvenue{" "}
            {currentUser?.firstName && currentUser?.lastName
              ? `${currentUser.firstName} ${currentUser.lastName}`
              : currentUser?.email.split("@")[0]}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <Label htmlFor="initialAmount" className="text-base">
              Fond de caisse initial (€)
            </Label>
            <Input
              id="initialAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              className="mt-2 text-lg h-12"
              autoFocus
            />
            <p className="text-sm text-muted-foreground mt-2">
              Montant en espèces disponible en début de journée
            </p>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleOpenRegister}
            disabled={!initialAmount || isLoading}
          >
            {isLoading ? "Ouverture en cours..." : "Ouvrir la caisse"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CashRegisterOpening;
