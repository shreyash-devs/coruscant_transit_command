import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Fleet from "./pages/Fleet";
import Simulation from "./pages/Simulation";
import RoutesMap from "./pages/RoutesMap";
import StopsMap from "./pages/StopsMap";
import Suggestions from "./pages/Suggestions";
import AdminSuggestions from "./pages/AdminSuggestions";
import NotFound from "./pages/NotFound";
import Prediction from "./pages/Prediction";
import { getSessionRole } from "./lib/suggestionsApi";

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const role = getSessionRole();
  if (role !== "admin") return <Navigate to="/suggestions" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/prediction" element={<Prediction />} />
          <Route path="/suggestions" element={<Suggestions />} />
          <Route
            path="/admin/suggestions"
            element={
              <AdminRoute>
                <AdminSuggestions />
              </AdminRoute>
            }
          />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/routes-map" element={<RoutesMap />} />
          <Route path="/stops-map" element={<StopsMap />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
