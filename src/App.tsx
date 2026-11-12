
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ScrollManager from "./components/ScrollManager";
import { legacyDashboardTarget } from "@/lib/dashboardLinks";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import PwaPrompts from "./components/pwa/PwaPrompts";
import BrowserAdviceBanner from "./components/pwa/BrowserAdviceBanner";
import { ConsultFlowProvider } from "./components/flow/ConsultFlow";
import { CookieNotice } from "./components/privacy/CookieNotice";

// Lazy-loaded components
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const SessionVideoRoom = lazy(() => import("./components/SessionVideoRoom"));
const BabalawoProfile = lazy(() => import("./components/BabalawoProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SearchPage = lazy(() => import("./pages/Search"));
const BabalawoApply = lazy(() => import("./pages/BabalawoApply"));
const Legal = lazy(() => import("./pages/Legal"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFailed = lazy(() => import("./pages/PaymentFailed"));
const PrivacyRequestPage = lazy(() => import("./pages/PrivacyRequest"));

/** Old dashboard paths (/dashboard/user, /dashboard/admin) go to /dashboard, keeping the section. */
const LegacyDashboard = ({ tab }: { tab?: string }) => {
  const { search } = useLocation();
  return <Navigate to={legacyDashboardTarget(search, tab)} replace />;
};

/** /babalawos was the old name of the listing; keep any ?query. */
const BabalawosRedirect = () => {
  const { search } = useLocation();
  return <Navigate to={`/search${search}`} replace />;
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PwaPrompts />
        <BrowserAdviceBanner />
        <BrowserRouter>
          <ScrollManager />
          <CookieNotice />
          <ConsultFlowProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/babalawo/:babalawoId" element={<BabalawoProfile />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:sessionId"
                element={
                  <ProtectedRoute>
                    <SessionVideoRoom />
                  </ProtectedRoute>
                }
              />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/become-a-babalawo" element={<BabalawoApply />} />
              <Route path="/terms" element={<Legal doc="terms" />} />
              <Route path="/privacy" element={<Legal doc="privacy" />} />
              <Route path="/refunds" element={<Legal doc="refunds" />} />
              <Route path="/cookies" element={<Legal doc="cookies" />} />
              <Route path="/privacy/request" element={<PrivacyRequestPage />} />
              <Route path="/data-request" element={<Navigate to="/privacy/request" replace />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/help" element={<Navigate to="/support" replace />} />
              <Route path="/babalawos" element={<BabalawosRedirect />} />
              <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
              <Route path="/payment/failed" element={<PaymentFailed />} />
              <Route path="/payment-success" element={<Navigate to="/payment/success" replace />} />
              <Route path="/payment-failed" element={<Navigate to="/payment/failed" replace />} />
              <Route path="/dashboard/user" element={<LegacyDashboard />} />
              <Route path="/dashboard/user/*" element={<LegacyDashboard />} />
              <Route path="/dashboard/admin" element={<LegacyDashboard />} />
              <Route path="/dashboard/admin/*" element={<LegacyDashboard />} />
              <Route path="/dashboard/babalawo" element={<LegacyDashboard />} />
              <Route path="/admin" element={<LegacyDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ConsultFlowProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
