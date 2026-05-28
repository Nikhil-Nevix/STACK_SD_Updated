import { useEffect } from "react";
import {
  useGetDashboardSummary,
  useGetSlaAtRisk,
  useGetRecentActivity,
  getGetDashboardSummaryQueryKey,
  getGetSlaAtRiskQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SLABadge } from "@/components/common/SLABadge";
import { StatusTag } from "@/components/common/StatusTag";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Ticket, CheckCircle2, ShieldAlert, Zap, Clock, Activity } from "lucide-react";

const USE_CASE_LABELS: Record<string, string> = {
  sharepoint_access: "SP Access",
  sharepoint_admin: "SP Admin",
  license_bluebeam: "Bluebeam",
  license_adobe: "Adobe",
  license_o365: "O365",
  dl_update: "DL Update",
  windows_troubleshooting: "Windows",
};

const COLORS = ["#1B3A6B", "#F47920", "#0097A7", "#6366f1", "#10b981", "#f59e0b", "#ef4444"];

function KPICard({ title, value, sub, icon: Icon, color }: { title: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: slaAtRisk, isLoading: slaLoading } = useGetSlaAtRisk({
    query: { queryKey: getGetSlaAtRiskQueryKey() },
  });
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSlaAtRiskQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const barData = summary?.tickets_by_use_case
    ? Object.entries(summary.tickets_by_use_case).map(([key, val]) => ({
        name: USE_CASE_LABELS[key] || key,
        count: val,
      }))
    : [];

  const pieData = summary
    ? [
        { name: "Auto Resolved", value: Math.round((summary.auto_resolution_rate / 100) * summary.total_open) || 1 },
        { name: "Manual", value: summary.total_open - Math.round((summary.auto_resolution_rate / 100) * summary.total_open) || 1 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">STACK Service Desk — live overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <KPICard title="Total Open Tickets" value={summary?.total_open ?? 0} sub="Active in queue" icon={Ticket} color="#1B3A6B" />
            <KPICard title="Resolved Today" value={summary?.resolved_today ?? 0} sub="Auto + manual" icon={CheckCircle2} color="#10b981" />
            <KPICard title="SLA Compliance" value={`${summary?.sla_met_percent ?? 0}%`} sub="Meeting SLA targets" icon={ShieldAlert} color="#0097A7" />
            <KPICard title="Auto-Resolution Rate" value={`${summary?.auto_resolution_rate ?? 0}%`} sub="AI-resolved tickets" icon={Zap} color="#F47920" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Tickets by Use Case</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resolution Split</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#F47920" : "#1B3A6B"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SLA At Risk + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> SLA At Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {slaLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !slaAtRisk?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No tickets at risk</div>
            ) : (
              <div className="divide-y">
                {slaAtRisk.slice(0, 8).map((t) => (
                  <div key={t.ticket_id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30" data-testid={`row-sla-${t.ticket_id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.use_case?.replace(/_/g, " ")}</p>
                    </div>
                    <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                      <StatusTag type="priority" value={t.priority} />
                      <SLABadge status={t.sla_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0097A7]" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activityLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !activity?.length ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No recent activity</div>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {activity.slice(0, 10).map((log) => (
                  <div key={log.log_id} className="px-4 py-3 flex items-start gap-3" data-testid={`activity-${log.log_id}`}>
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-[#0097A7] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{log.event_type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground truncate">by {log.actor} · {new Date(log.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
