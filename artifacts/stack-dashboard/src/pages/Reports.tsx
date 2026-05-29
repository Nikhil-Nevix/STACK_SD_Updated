import { useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import {
  useGetResolutionRate,
  useGetSlaCompliance,
  useGetTicketTrends,
  useGetAiAccuracy,
  useGetAgentPerformance,
  getGetResolutionRateQueryKey,
  getGetSlaComplianceQueryKey,
  getGetTicketTrendsQueryKey,
  getGetAiAccuracyQueryKey,
  getGetAgentPerformanceQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
  AreaChart, Area,
  CartesianGrid,
} from "recharts";
import { Download } from "lucide-react";

const COLORS = ["#1B3A6B", "#F47920", "#0097A7", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground">{children}</h2>;
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const handleExport = useCallback(async () => {
    const token = getToken();
    const params = new URLSearchParams({ report_type: "tickets", date_from: dateFrom, date_to: dateTo });
    const res = await fetch(`/api/v1/reports/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stack-report-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dateFrom, dateTo]);

  const params = { date_from: dateFrom, date_to: dateTo };

  const { data: resRate, isLoading: rateLoading } = useGetResolutionRate(params, { query: { queryKey: getGetResolutionRateQueryKey(params) } });
  const { data: sla, isLoading: slaLoading } = useGetSlaCompliance(params, { query: { queryKey: getGetSlaComplianceQueryKey(params) } });
  const { data: trends, isLoading: trendsLoading } = useGetTicketTrends({ ...params, granularity: "daily" }, { query: { queryKey: getGetTicketTrendsQueryKey({ ...params, granularity: "daily" }) } });
  const { data: aiAccuracy, isLoading: aiLoading } = useGetAiAccuracy(params, { query: { queryKey: getGetAiAccuracyQueryKey(params) } });
  const { data: agentPerf, isLoading: agentLoading } = useGetAgentPerformance(params, { query: { queryKey: getGetAgentPerformanceQueryKey(params) } });

  const barData = resRate?.items?.map(item => ({
    name: item.use_case.replace(/_/g, " ").replace(/license /i, "").replace(/sharepoint /i, "SP "),
    Auto: item.auto_count,
    Manual: item.manual_count,
  })) ?? [];

  const slaDonut = sla ? [
    { name: "Met", value: sla.met_count },
    { name: "At Risk", value: sla.at_risk_count },
    { name: "Breached", value: sla.breached_count },
  ] : [];

  const trendData = trends?.trend ?? [];
  const accuracyTrend = aiAccuracy?.trend ?? [];
  const distData = aiAccuracy?.distribution ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Analytics and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" data-testid="input-date-from" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" data-testid="input-date-to" />
          <Button size="sm" variant="outline" className="gap-1.5 h-9" data-testid="button-export" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Resolution Rate */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><SectionTitle>Resolution Rate by Use Case</SectionTitle></CardHeader>
        <CardContent>
          {rateLoading ? <Skeleton className="h-52 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Auto" fill="#F47920" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Manual" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* SLA Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><SectionTitle>SLA Compliance</SectionTitle></CardHeader>
          <CardContent>
            {slaLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={slaDonut} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {slaDonut.map((_, i) => (
                        <Cell key={i} fill={["#10b981", "#f59e0b", "#ef4444"][i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-foreground">{sla?.compliance_percent ?? 0}%</div>
                  <p className="text-sm text-muted-foreground">compliance rate</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> <span>Met: {sla?.met_count ?? 0}</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /> <span>At Risk: {sla?.at_risk_count ?? 0}</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> <span>Breached: {sla?.breached_count ?? 0}</span></div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><SectionTitle>SLA Compliance Trend</SectionTitle></CardHeader>
          <CardContent>
            {slaLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={sla?.trend ?? []} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="compliance" stroke="#0097A7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ticket Trends */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><SectionTitle>Ticket Trends</SectionTitle></CardHeader>
        <CardContent>
          {trendsLoading ? <Skeleton className="h-52 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="total" stroke="#1B3A6B" fill="#1B3A6B22" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* AI Accuracy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><SectionTitle>AI Confidence Trend</SectionTitle></CardHeader>
          <CardContent>
            {aiLoading ? <Skeleton className="h-48 w-full" /> : (
              <div>
                <div className="text-3xl font-bold mb-3">{Math.round(aiAccuracy?.avg_confidence ?? 0)}% <span className="text-base font-normal text-muted-foreground">avg confidence</span></div>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={accuracyTrend} margin={{ left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="avg_confidence" stroke="#F47920" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><SectionTitle>Confidence Score Distribution</SectionTitle></CardHeader>
          <CardContent>
            {aiLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distData} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#0097A7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><SectionTitle>Agent Performance</SectionTitle></CardHeader>
        <CardContent className="p-0">
          {agentLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-left px-4 py-3 font-medium">Tickets Handled</th>
                  <th className="text-left px-4 py-3 font-medium">Avg Resolution Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(agentPerf ?? []).map((a) => (
                  <tr key={a.agent_id} className="hover:bg-muted/30" data-testid={`row-agent-${a.agent_id}`}>
                    <td className="px-4 py-3 font-medium">{a.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.tickets_handled}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.avg_resolution_mins?.toFixed(1)} mins</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
