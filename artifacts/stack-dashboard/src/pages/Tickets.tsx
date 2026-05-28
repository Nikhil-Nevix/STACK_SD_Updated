import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListTickets,
  useResolveTicket,
  useEscalateTicket,
  useUpdateTicket,
  getListTicketsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SLABadge } from "@/components/common/SLABadge";
import { StatusTag } from "@/components/common/StatusTag";
import { useToast } from "@/hooks/use-toast";
import { Search, Zap, ChevronUp, X, Eye, ChevronLeft, ChevronRight } from "lucide-react";

const USE_CASES = [
  "sharepoint_access", "sharepoint_admin", "license_bluebeam",
  "license_adobe", "license_o365", "dl_update", "windows_troubleshooting",
];

const USE_CASE_LABELS: Record<string, string> = {
  sharepoint_access: "SharePoint Access",
  sharepoint_admin: "SharePoint Admin",
  license_bluebeam: "Bluebeam License",
  license_adobe: "Adobe License",
  license_o365: "O365 License",
  dl_update: "DL Update",
  windows_troubleshooting: "Windows",
};

function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? "bg-emerald-100 text-emerald-800" : pct >= 60 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct}%</span>;
}

export default function Tickets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", use_case: "", priority: "", sla_status: "", search: "" });
  const LIMIT = 20;

  const params = {
    page,
    limit: LIMIT,
    ...(filters.status ? { status: filters.status as any } : {}),
    ...(filters.use_case ? { use_case: filters.use_case as any } : {}),
    ...(filters.priority ? { priority: filters.priority as any } : {}),
    ...(filters.sla_status ? { sla_status: filters.sla_status as any } : {}),
  };

  const { data, isLoading } = useListTickets(params, {
    query: { queryKey: getListTicketsQueryKey(params) },
  });

  const resolveTicket = useResolveTicket();
  const escalateTicket = useEscalateTicket();
  const updateTicket = useUpdateTicket();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tickets"] });

  const handleResolve = (id: string) => {
    resolveTicket.mutate({ id }, { onSuccess: () => { toast({ title: "AI resolution triggered" }); invalidate(); } });
  };

  const handleEscalate = (id: string) => {
    escalateTicket.mutate({ id, data: { reason: "Manual escalation" } }, {
      onSuccess: () => { toast({ title: "Ticket escalated" }); invalidate(); }
    });
  };

  const handleClose = (id: string) => {
    updateTicket.mutate({ id, data: { status: "closed" } }, {
      onSuccess: () => { toast({ title: "Ticket closed" }); invalidate(); }
    });
  };

  const setFilter = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: "", use_case: "", priority: "", sla_status: "", search: "" });
    setPage(1);
  };

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ticket Queue</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} tickets total</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="pl-9 h-9 w-52"
                data-testid="input-search"
              />
            </div>
            <Select value={filters.status || "all"} onValueChange={(v) => setFilter("status", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-36" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="auto_resolved">Auto Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.use_case || "all"} onValueChange={(v) => setFilter("use_case", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-44" data-testid="select-usecase">
                <SelectValue placeholder="Use Case" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All use cases</SelectItem>
                {USE_CASES.map(uc => <SelectItem key={uc} value={uc}>{USE_CASE_LABELS[uc]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.priority || "all"} onValueChange={(v) => setFilter("priority", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-32" data-testid="select-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.sla_status || "all"} onValueChange={(v) => setFilter("sla_status", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-32" data-testid="select-sla">
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SLA</SelectItem>
                <SelectItem value="safe">Safe</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground">
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ticket</th>
                <th className="text-left px-4 py-3 font-medium">Use Case</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Priority</th>
                <th className="text-left px-4 py-3 font-medium">SLA</th>
                <th className="text-left px-4 py-3 font-medium">AI Confidence</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No tickets found</td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.ticket_id} className="hover:bg-muted/30 transition-colors" data-testid={`row-ticket-${t.ticket_id}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground truncate max-w-[220px]">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.freshservice_ticket_id || t.ticket_id?.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-normal border-[#0097A7]/30 text-[#0097A7]">
                        {USE_CASE_LABELS[t.use_case] || t.use_case}
                      </Badge>
                    </td>
                    <td className="px-4 py-3"><StatusTag type="status" value={t.status} /></td>
                    <td className="px-4 py-3"><StatusTag type="priority" value={t.priority} /></td>
                    <td className="px-4 py-3"><SLABadge status={t.sla_status} /></td>
                    <td className="px-4 py-3"><ConfidenceBadge score={t.confidence_score} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{t.assigned_agent_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setLocation(`/tickets/${t.ticket_id}`)} data-testid={`button-view-${t.ticket_id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {(t.status === "open" || t.status === "in_progress") && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[#F47920] hover:text-[#F47920]" onClick={() => handleResolve(t.ticket_id)} data-testid={`button-resolve-${t.ticket_id}`}>
                              <Zap className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600 hover:text-amber-600" onClick={() => handleEscalate(t.ticket_id)} data-testid={`button-escalate-${t.ticket_id}`}>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => handleClose(t.ticket_id)} data-testid={`button-close-${t.ticket_id}`}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm px-2">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="button-next-page">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
