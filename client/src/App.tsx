import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EvaluationProvider } from "./contexts/EvaluationContext";
import { useEvaluation } from "./contexts/EvaluationContext";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Evaluate from "./pages/Evaluate";
import BatchEvaluate from "./pages/BatchEvaluate";
import History from "./pages/History";
import KnowledgeBase from "./pages/KnowledgeBase";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Architecture from "./pages/Architecture";
import Documentation from "./pages/Documentation";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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
            <Router />
          </TooltipProvider>
        </EvaluationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
