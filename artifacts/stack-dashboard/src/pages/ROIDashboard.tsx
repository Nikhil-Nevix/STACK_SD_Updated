import { useState } from "react";
import {
  useGetCurrentRoi,
  useGetRoiHistory,
  useUpdateRoiSettings,
  getGetCurrentRoiQueryKey,
  getGetRoiHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell,
} from "recharts";
import { TrendingUp, Clock, IndianRupee, Zap, Settings } from "lucide-react";

function KPI({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ROIDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hourlyCost, setHourlyCost] = useState("");
  const [resolutionTime, setResolutionTime] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const { data: current, isLoading: currentLoading } = useGetCurrentRoi({
    query: { queryKey: getGetCurrentRoiQueryKey() },
  });
  const { data: history, isLoading: historyLoading } = useGetRoiHistory({
    query: { queryKey: getGetRoiHistoryQueryKey() },
  });

  const updateSettings = useUpdateRoiSettings();

  const handleSaveSettings = () => {
    updateSettings.mutate(
      { data: { agent_hourly_cost: parseFloat(hourlyCost) || 500, avg_manual_resolution_mins: parseFloat(resolutionTime) || 45 } },
      {
        onSuccess: () => {
          toast({ title: "ROI settings updated" });
          queryClient.invalidateQueries({ queryKey: getGetCurrentRoiQueryKey() });
          setShowSettings(false);
        },
      }
    );
  };

  const trend = (history ?? []).map((m) => ({
    period: m.period_end.slice(0, 7),
    "Hours Saved": Math.round(m.hours_saved * 10) / 10,
    "Cost Saved (₹K)": Math.round(m.cost_saved / 1000),
  }));

  const comparison = [
    { name: "Auto AI", value: current?.avg_auto_resolution_mins ?? 12.5, fill: "#F47920" },
    { name: "Manual", value: current?.avg_manual_resolution_mins ?? 45, fill: "#1B3A6B" },
  ];

  const formatCurrency = (v: number | undefined) => {
    if (!v) return "₹0";
    return `₹${(v / 1000).toFixed(0)}K`;
  };

  const paybackPct = Math.min(100, ((current?.auto_resolved_count ?? 0) / Math.max(current?.total_tickets ?? 1, 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-[#1B3A6B] to-[#0097A7] rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6" />
          <h2 className="text-lg font-semibold">This Month: STACK has saved Jade Global</h2>
        </div>
        {currentLoading ? (
          <Skeleton className="h-10 w-64 bg-white/20" />
        ) : (
          <div className="flex items-end gap-6">
            <div>
              <span className="text-4xl font-bold">{Math.round(current?.hours_saved ?? 0)}</span>
              <span className="text-xl ml-1 text-blue-200">hours</span>
            </div>
            <div className="text-2xl text-blue-200">and</div>
            <div>
              <span className="text-4xl font-bold">{formatCurrency(current?.cost_saved)}</span>
              <span className="text-xl ml-1 text-blue-200">in cost</span>
            </div>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {currentLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>)
        ) : (
          <>
            <KPI label="Total Tickets" value={String(current?.total_tickets ?? 0)} icon={Zap} color="#1B3A6B" />
            <KPI label="Auto Resolved" value={String(current?.auto_resolved_count ?? 0)} icon={Zap} color="#F47920" />
            <KPI label="Hours Saved" value={`${Math.round(current?.hours_saved ?? 0)}h`} icon={Clock} color="#0097A7" />
            <KPI label="Cost Saved" value={formatCurrency(current?.cost_saved)} icon={IndianRupee} color="#10b981" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Monthly ROI Trend</CardTitle></CardHeader>
          <CardContent>
            {historyLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Hours Saved" stroke="#F47920" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Cost Saved (₹K)" stroke="#0097A7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Avg Resolution Time Comparison</CardTitle></CardHeader>
          <CardContent>
            {currentLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={comparison} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v} mins`]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {comparison.map((c, i) => (
                        <Cell key={i} fill={c.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="text-sm text-muted-foreground text-center">
                  AI resolves tickets <strong className="text-[#F47920]">{Math.round((current?.avg_manual_resolution_mins ?? 45) / (current?.avg_auto_resolution_mins ?? 12.5))}x faster</strong> than manual handling
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payback Progress */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Auto-Resolution Coverage</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{current?.auto_resolved_count ?? 0} of {current?.total_tickets ?? 0} tickets auto-resolved</span>
            <span className="font-semibold text-[#F47920]">{Math.round(paybackPct)}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-[#F47920] rounded-full transition-all" style={{ width: `${paybackPct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Admin Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowSettings(s => !s)}>
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Settings className="w-4 h-4" /> ROI Calculation Settings (Admin)
          </CardTitle>
        </CardHeader>
        {showSettings && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Agent Hourly Cost (₹)</label>
                <Input
                  type="number"
                  value={hourlyCost}
                  onChange={(e) => setHourlyCost(e.target.value)}
                  placeholder={`${current?.agent_hourly_cost ?? 500}`}
                  className="h-9"
                  data-testid="input-hourly-cost"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Avg Manual Resolution Time (mins)</label>
                <Input
                  type="number"
                  value={resolutionTime}
                  onChange={(e) => setResolutionTime(e.target.value)}
                  placeholder={`${current?.avg_manual_resolution_mins ?? 45}`}
                  className="h-9"
                  data-testid="input-resolution-time"
                />
              </div>
            </div>
            <Button size="sm" className="bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white" onClick={handleSaveSettings} disabled={updateSettings.isPending} data-testid="button-save-roi">
              Save Settings
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

