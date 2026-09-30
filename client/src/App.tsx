import React, { useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EvaluationProvider } from "./contexts/EvaluationContext";
import { useEvaluation } from "./contexts/EvaluationContext";

const Home = lazy(() => import("./pages/Home"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Evaluate = lazy(() => import("./pages/Evaluate"));
const BatchEvaluate = lazy(() => import("./pages/BatchEvaluate"));
const History = lazy(() => import("./pages/History"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Reports = lazy(() => import("./pages/Reports"));
const Architecture = lazy(() => import("./pages/Architecture"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** Redirects unauthenticated users to /login */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { userProfile } = useEvaluation();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!userProfile.isLoggedIn) {
      setLocation("/login");
    }
  }, [userProfile.isLoggedIn, setLocation]);

  if (!userProfile.isLoggedIn) return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Overview Landing Page */}
      <Route path="/" component={Home} />

      {/* Authentication */}
      <Route path="/login" component={LoginPage} />

      {/* Protected Product Routes */}
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/evaluate">{() => <ProtectedRoute component={Evaluate} />}</Route>
      <Route path="/batch">{() => <ProtectedRoute component={BatchEvaluate} />}</Route>
      <Route path="/history">{() => <ProtectedRoute component={History} />}</Route>
      <Route path="/knowledge-base">{() => <ProtectedRoute component={KnowledgeBase} />}</Route>
      <Route path="/analytics">{() => <ProtectedRoute component={Analytics} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/architecture">{() => <ProtectedRoute component={Architecture} />}</Route>
      <Route path="/docs">{() => <ProtectedRoute component={Documentation} />}</Route>
      <Route path="/documentation">{() => <ProtectedRoute component={Documentation} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <EvaluationProvider>
          <TooltipProvider>
            <Toaster />
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-[#0d0b12] text-[#9e97b3] text-sm">
                Loading VeriAI...
              </div>
            }>
              <Router />
            </Suspense>
          </TooltipProvider>
        </EvaluationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

