import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import Index from "./pages/Index";
import Login from "./pages/Login";
import CashRegisterOpening from "./pages/CashRegisterOpening";
import POS from "./pages/POS";
import SalesHistory from "./pages/SalesHistory";
import CashRegisterClosing from "./pages/CashRegisterClosing";
import NotFound from "./pages/NotFound";
import Tables from "./pages/table";
import NF525Archive from "./pages/NF525Archive";
import NF525Attestation from "./pages/NF525Attestation";

const queryClient = new QueryClient();

const App = () => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/cash-register-opening"
                element={<CashRegisterOpening />}
              />
              <Route path="/pos" element={<POS />} />
              <Route path="/tables" element={<Tables />} />
              <Route path="/sales-history" element={<SalesHistory />} />
              <Route
                path="/cash-register-closing"
                element={<CashRegisterClosing />}
              />
              <Route path="/nf525-archive" element={<NF525Archive />} />
              <Route path="/nf525-attestation" element={<NF525Attestation />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;
