import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import { ShieldCheck, Zap, UserCheck, Clock, Award } from "lucide-react";

interface AgentDetail {
  agent_id: string;
  full_name: string;
  email: string;
  role: string;
  tickets_handled: number;
  avg_resolution_mins: number;
  sla_compliance_percent: number;
  auto_resolution_percent: number;
}

export default function AgentPerformance() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAgentData() {
      setIsLoading(true);
      try {
        const token = getToken();
        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
        const res = await fetch(`/api/v1/reports/agent-performance-detail?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch (err) {
        console.error("Error fetching agent performance details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAgentData();
  }, [dateFrom, dateTo]);

  // Aggregate metrics
  const totalTickets = agents.reduce((acc, curr) => acc + curr.tickets_handled, 0);
  const avgSlaCompliance = agents.length > 0
    ? Math.round(agents.reduce((acc, curr) => acc + curr.sla_compliance_percent, 0) / agents.length)
    : 100;
  const avgAutoResolution = agents.length > 0
    ? Math.round(agents.reduce((acc, curr) => acc + curr.auto_resolution_percent, 0) / agents.length)
    : 0;
  
  // Find top agent by tickets handled & compliance > 90%
  const topAgent = agents.length > 0
    ? [...agents]
        .filter(a => a.sla_compliance_percent >= 85)
        .sort((a, b) => b.tickets_handled - a.tickets_handled)[0] || agents[0]
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
            Agent Performance Insights
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compare active agents across workload, speed, SLA compliance, and auto-resolution help.
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-card/60 backdrop-blur-md p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-xs bg-background/50 border-slate-200"
          />
          <span className="text-xs text-muted-foreground font-semibold">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-xs bg-background/50 border-slate-200"
          />
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-md relative overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Performer</p>
                <h3 className="text-lg font-bold text-foreground truncate max-w-[150px]">
                  {topAgent ? topAgent.full_name : "N/A"}
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">High Compliance</p>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl dark:text-indigo-400">
                <Award className="w-6 h-6 animate-pulse" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg SLA Compliance</p>
                <h3 className="text-3xl font-extrabold text-foreground">{avgSlaCompliance}%</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Safe Boundary</p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl dark:text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Auto-Resolution Help</p>
                <h3 className="text-3xl font-extrabold text-foreground">{avgAutoResolution}%</h3>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">AI Delegation</p>
              </div>
              <div className="p-3 bg-orange-500/10 text-orange-600 rounded-xl dark:text-orange-400">
                <Zap className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-card/60 backdrop-blur-md">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Handled</p>
                <h3 className="text-3xl font-extrabold text-foreground">{totalTickets}</h3>
                <p className="text-xs text-muted-foreground font-medium">Closed Tickets</p>
              </div>
              <div className="p-3 bg-slate-500/10 text-slate-600 rounded-xl dark:text-slate-400">
                <UserCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Visual Chart Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-100 dark:border-slate-800 shadow-sm bg-card/65 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base font-bold">Tickets Handled by Agent</CardTitle>
            <CardDescription className="text-xs">Comparison of workloads distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agents} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
                  <XAxis dataKey="full_name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="tickets_handled" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-100 dark:border-slate-800 shadow-sm bg-card/65 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="text-base font-bold">SLA Compliance Rate (%)</CardTitle>
            <CardDescription className="text-xs">Consistency rate of meeting SLA deadlines</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agents} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
                  <XAxis dataKey="full_name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sla_compliance_percent" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Agent Details Table */}
      <Card className="border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-card/65 backdrop-blur-lg">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-bold">Detailed Support Roster</CardTitle>
          <CardDescription className="text-xs">Granular analysis of agent queues and service level parameters.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-muted-foreground border-b dark:border-slate-800">
                  <tr>
                    <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">Agent</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">Email / Role</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">Tickets Handled</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">Avg Speed</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">SLA Met</th>
                    <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">Auto-Res Help</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {agents.map((a) => (
                    <tr key={a.agent_id} className="hover:bg-slate-50/45 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="px-5 py-4 font-bold text-foreground">{a.full_name}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        <div>{a.email}</div>
                        <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                          {a.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-semibold">{a.tickets_handled}</td>
                      <td className="px-5 py-4 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{a.avg_resolution_mins.toFixed(1)} mins</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          a.sla_compliance_percent >= 90
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : a.sla_compliance_percent >= 75
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                            : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                        }`}>
                          {a.sla_compliance_percent}%
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {a.auto_resolution_percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
