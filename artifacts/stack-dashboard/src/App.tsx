import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { isAuthenticated } from "@/lib/auth";
import "@/lib/api-client";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Tickets from "@/pages/Tickets";
import TicketDetail from "@/pages/TicketDetail";
import Logs from "@/pages/Logs";
import Reports from "@/pages/Reports";
import ExportableReports from "@/pages/ExportableReports";
import AgentPerformance from "@/pages/AgentPerformance";
import ROIDashboard from "@/pages/ROIDashboard";
import Admin from "@/pages/Admin";
import SOPManager from "@/pages/SOPManager";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) {
    return <RedirectTo to="/login" />;
  }
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/tickets/:id">
        {() => <ProtectedRoute component={TicketDetail} />}
      </Route>
      <Route path="/tickets">
        {() => <ProtectedRoute component={Tickets} />}
      </Route>
      <Route path="/logs">
        {() => <ProtectedRoute component={Logs} />}
      </Route>
      <Route path="/reports">
        {() => <ProtectedRoute component={Reports} />}
      </Route>
      <Route path="/exportable-reports">
        {() => <ProtectedRoute component={ExportableReports} />}
      </Route>
      <Route path="/agent-performance">
        {() => <ProtectedRoute component={AgentPerformance} />}
      </Route>
      <Route path="/roi">
        {() => <ProtectedRoute component={ROIDashboard} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin} />}
      </Route>
      <Route path="/sop-manager">
        {() => <ProtectedRoute component={SOPManager} />}
      </Route>
      <Route path="/">
        {() => {
          if (isAuthenticated()) return <RedirectTo to="/dashboard" />;
          return <RedirectTo to="/login" />;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
