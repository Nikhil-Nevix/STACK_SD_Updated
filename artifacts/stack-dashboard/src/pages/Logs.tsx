import { useState } from "react";
import {
  useGetAuditLogs,
  useGetApiCallLogs,
  useGetPowershellLogs,
  getGetAuditLogsQueryKey,
  getGetApiCallLogsQueryKey,
  getGetPowershellLogsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

function StatusDot({ code }: { code: number }) {
  const cls = code < 300 ? "bg-emerald-500" : code < 500 ? "bg-amber-500" : "bg-red-500";
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function Pagination({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
      <p className="text-sm text-muted-foreground">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-sm px-2">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page === totalPages}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function AuditLogsTab() {
  const [page, setPage] = useState(1);
  const params = { page, limit: 20 };
  const { data, isLoading } = useGetAuditLogs(params, { query: { queryKey: getGetAuditLogsQueryKey(params) } });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Event</th>
              <th className="text-left px-4 py-3 font-medium">Actor</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Ticket</th>
              <th className="text-left px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No audit logs found</td></tr>
            ) : logs.map((l) => (
              <tr key={l.log_id} className="hover:bg-muted/30" data-testid={`row-audit-${l.log_id}`}>
                <td className="px-4 py-3 font-medium">{l.event_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.actor}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{l.actor_type}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{l.ticket_id?.slice(0, 8) || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} limit={20} onChange={setPage} />
    </Card>
  );
}

function ApiCallLogsTab() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const params = { page, limit: 20 };
  const { data, isLoading } = useGetApiCallLogs(params, { query: { queryKey: getGetApiCallLogsQueryKey(params) } });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">API</th>
              <th className="text-left px-4 py-3 font-medium">Endpoint</th>
              <th className="text-left px-4 py-3 font-medium">Method</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Duration</th>
              <th className="text-left px-4 py-3 font-medium">Time</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No API call logs found</td></tr>
            ) : logs.map((l) => (
              <>
                <tr key={l.api_log_id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpanded(expanded === l.api_log_id ? null : l.api_log_id)} data-testid={`row-api-${l.api_log_id}`}>
                  <td className="px-4 py-3 font-medium">{l.api_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[160px]">{l.endpoint}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded font-mono bg-muted">{l.method}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusDot code={l.response_status} />
                      <span className="font-mono text-xs">{l.response_status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{l.duration_ms ? `${l.duration_ms}ms` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(l.called_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === l.api_log_id ? "rotate-180" : ""}`} /></td>
                </tr>
                {expanded === l.api_log_id && (
                  <tr key={`${l.api_log_id}-detail`}>
                    <td colSpan={7} className="px-4 py-3 bg-muted/30">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-semibold mb-1 text-muted-foreground">Request</p>
                          <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(l.request_payload, null, 2) || "null"}</pre>
                        </div>
                        <div>
                          <p className="font-semibold mb-1 text-muted-foreground">Response</p>
                          <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(l.response_payload, null, 2) || "null"}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} limit={20} onChange={setPage} />
    </Card>
  );
}

function PsLogsTab() {
  const [page, setPage] = useState(1);
  const params = { page, limit: 20 };
  const { data, isLoading } = useGetPowershellLogs(params, { query: { queryKey: getGetPowershellLogsQueryKey(params) } });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Script</th>
              <th className="text-left px-4 py-3 font-medium">Device</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Duration</th>
              <th className="text-left px-4 py-3 font-medium">Executed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No PowerShell executions found</td></tr>
            ) : logs.map((l) => (
              <tr key={l.execution_id} className="hover:bg-muted/30" data-testid={`row-ps-${l.execution_id}`}>
                <td className="px-4 py-3 font-mono text-xs">{l.script_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.device_name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.execution_status === "success" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {l.execution_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{l.duration_seconds ? `${l.duration_seconds}s` : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(l.executed_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} limit={20} onChange={setPage} />
    </Card>
  );
}

export default function Logs() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">System Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Audit trails, API calls, and PowerShell executions</p>
      </div>
      <Tabs defaultValue="audit">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="api" data-testid="tab-api">API Call Logs</TabsTrigger>
          <TabsTrigger value="ps" data-testid="tab-ps">PowerShell Executions</TabsTrigger>
        </TabsList>
        <TabsContent value="audit" className="mt-4"><AuditLogsTab /></TabsContent>
        <TabsContent value="api" className="mt-4"><ApiCallLogsTab /></TabsContent>
        <TabsContent value="ps" className="mt-4"><PsLogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
