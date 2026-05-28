import { useState } from "react";
import {
  useGetThresholds,
  useGetSlaConfigs,
  useGetAgentGroups,
  useListAgents,
  useUpdateThreshold,
  useUpdateSlaConfig,
  useUpdateAgentGroup,
  useCreateAgent,
  getGetThresholdsQueryKey,
  getGetSlaConfigsQueryKey,
  getGetAgentGroupsQueryKey,
  getListAgentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Check, X, Users, Star } from "lucide-react";

const USE_CASE_LABELS: Record<string, string> = {
  sharepoint_access: "SharePoint Access",
  sharepoint_admin: "SharePoint Admin",
  license_bluebeam: "Bluebeam License",
  license_adobe: "Adobe License",
  license_o365: "O365 License",
  dl_update: "DL Update",
  windows_troubleshooting: "Windows",
};

function ThresholdsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: thresholds, isLoading } = useGetThresholds({ query: { queryKey: getGetThresholdsQueryKey() } });
  const updateThreshold = useUpdateThreshold();
  const [editing, setEditing] = useState<string | null>(null);
  const [vals, setVals] = useState<{ auto: string; review: string }>({ auto: "", review: "" });

  const startEdit = (t: any) => {
    setEditing(t.threshold_id);
    setVals({ auto: String(t.auto_resolve_min), review: String(t.review_after_min) });
  };

  const save = (id: string) => {
    updateThreshold.mutate({ id, data: { auto_resolve_min: parseFloat(vals.auto), review_after_min: parseFloat(vals.review) } }, {
      onSuccess: () => {
        toast({ title: "Threshold updated" });
        queryClient.invalidateQueries({ queryKey: getGetThresholdsQueryKey() });
        setEditing(null);
      },
    });
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Use Case</th>
            <th className="text-left px-4 py-3 font-medium">Auto Resolve Min (%)</th>
            <th className="text-left px-4 py-3 font-medium">Review After Min (%)</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
            ))
          ) : (thresholds ?? []).map((t) => (
            <tr key={t.threshold_id} className="hover:bg-muted/30" data-testid={`row-threshold-${t.threshold_id}`}>
              <td className="px-4 py-3 font-medium">{USE_CASE_LABELS[t.use_case] || t.use_case}</td>
              <td className="px-4 py-3">
                {editing === t.threshold_id ? (
                  <Input type="number" value={vals.auto} onChange={(e) => setVals(v => ({ ...v, auto: e.target.value }))} className="h-7 w-24 text-sm" />
                ) : (
                  <span className="font-mono">{t.auto_resolve_min}%</span>
                )}
              </td>
              <td className="px-4 py-3">
                {editing === t.threshold_id ? (
                  <Input type="number" value={vals.review} onChange={(e) => setVals(v => ({ ...v, review: e.target.value }))} className="h-7 w-24 text-sm" />
                ) : (
                  <span className="font-mono">{t.review_after_min}%</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editing === t.threshold_id ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => save(t.threshold_id)}><Check className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditing(null)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(t)} data-testid={`button-edit-threshold-${t.threshold_id}`}><Edit3 className="w-3.5 h-3.5" /></Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SlaConfigTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: configs, isLoading } = useGetSlaConfigs({ query: { queryKey: getGetSlaConfigsQueryKey() } });
  const updateSla = useUpdateSlaConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");

  const save = (id: string) => {
    updateSla.mutate({ id, data: { resolution_hours: parseInt(editHours, 10) } }, {
      onSuccess: () => {
        toast({ title: "SLA config updated" });
        queryClient.invalidateQueries({ queryKey: getGetSlaConfigsQueryKey() });
        setEditing(null);
      },
    });
  };

  const grouped: Record<string, any[]> = {};
  (configs ?? []).forEach(c => {
    if (!grouped[c.use_case]) grouped[c.use_case] = [];
    grouped[c.use_case].push(c);
  });

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Use Case</th>
            <th className="text-left px-4 py-3 font-medium">Low (h)</th>
            <th className="text-left px-4 py-3 font-medium">Medium (h)</th>
            <th className="text-left px-4 py-3 font-medium">High (h)</th>
            <th className="text-left px-4 py-3 font-medium">Urgent (h)</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
          ) : Object.entries(grouped).map(([uc, items]) => (
            <tr key={uc} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{USE_CASE_LABELS[uc] || uc}</td>
              {["low", "medium", "high", "urgent"].map(p => {
                const item = items.find(i => i.priority === p);
                return (
                  <td key={p} className="px-4 py-3">
                    {editing === item?.sla_id ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" value={editHours} onChange={(e) => setEditHours(e.target.value)} className="h-7 w-16 text-sm" />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => save(item!.sla_id)}><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <button className="font-mono hover:text-[#1B3A6B] cursor-pointer" onClick={() => { setEditing(item?.sla_id ?? null); setEditHours(String(item?.resolution_hours ?? "")); }}>
                        {item?.resolution_hours ?? "—"}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AgentGroupsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: groups, isLoading } = useGetAgentGroups({ query: { queryKey: getGetAgentGroupsQueryKey() } });
  const updateGroup = useUpdateAgentGroup();

  const handleModeChange = (id: string, mode: string) => {
    updateGroup.mutate({ id, data: { assignment_mode: mode as any } }, {
      onSuccess: () => { toast({ title: "Group updated" }); queryClient.invalidateQueries({ queryKey: getGetAgentGroupsQueryKey() }); }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>)
      ) : (groups ?? []).map((g) => (
        <Card key={g.group_id} className="border-0 shadow-sm" data-testid={`card-group-${g.group_id}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1B3A6B]" />
                  <span className="font-semibold">{g.group_name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{USE_CASE_LABELS[g.use_case] || g.use_case}</p>
              </div>
              <Select value={g.assignment_mode} onValueChange={(v) => handleModeChange(g.group_id, v)}>
                <SelectTrigger className="h-8 w-36 text-xs" data-testid={`select-mode-${g.group_id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="first_available">First Available</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              {(g.members ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No members</p>
              ) : (g.members ?? []).map((m: any) => (
                <div key={m.member_id} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[#1B3A6B]/10 flex items-center justify-center text-xs font-semibold text-[#1B3A6B]">
                    {m.full_name?.charAt(0)}
                  </div>
                  <span>{m.full_name}</span>
                  {m.full_name?.toLowerCase().includes("datta") && (
                    <Badge className="text-xs px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300 gap-1">
                      <Star className="w-2.5 h-2.5" /> Fallback
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AgentsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: agents, isLoading } = useListAgents({ query: { queryKey: getListAgentsQueryKey() } });
  const createAgent = useCreateAgent();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "agent" });

  const handleCreate = () => {
    createAgent.mutate({ data: form as any }, {
      onSuccess: () => {
        toast({ title: "Agent created" });
        queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
        setShowForm(false);
        setForm({ email: "", full_name: "", role: "agent" });
      },
    });
  };

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">System Agents</CardTitle>
          <Button size="sm" className="h-8 bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white" onClick={() => setShowForm(s => !s)} data-testid="button-add-agent">
            {showForm ? "Cancel" : "Add Agent"}
          </Button>
        </div>
        {showForm && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-sm" data-testid="input-agent-email" />
            <Input placeholder="Full Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="h-8 text-sm" data-testid="input-agent-name" />
            <div className="flex gap-2">
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="readonly">Read Only</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8" onClick={handleCreate} disabled={createAgent.isPending} data-testid="button-save-agent">Save</Button>
            </div>
          </div>
        )}
      </CardHeader>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Name</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Role</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
          ) : (agents ?? []).map((a) => (
            <tr key={a.agent_id} className="hover:bg-muted/30" data-testid={`row-agent-${a.agent_id}`}>
              <td className="px-4 py-3 font-medium">{a.full_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === "admin" ? "bg-[#1B3A6B]/10 text-[#1B3A6B]" : a.role === "readonly" ? "bg-muted text-muted-foreground" : "bg-[#0097A7]/10 text-[#0097A7]"}`}>
                  {a.role}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                  {a.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function Admin() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure thresholds, SLA, agent groups, and system settings</p>
      </div>
      <Tabs defaultValue="thresholds">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="thresholds" data-testid="tab-thresholds">Confidence Thresholds</TabsTrigger>
          <TabsTrigger value="sla" data-testid="tab-sla">SLA Config</TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">Agent Groups</TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">Agents</TabsTrigger>
        </TabsList>
        <TabsContent value="thresholds" className="mt-4"><ThresholdsTab /></TabsContent>
        <TabsContent value="sla" className="mt-4"><SlaConfigTab /></TabsContent>
        <TabsContent value="groups" className="mt-4"><AgentGroupsTab /></TabsContent>
        <TabsContent value="agents" className="mt-4"><AgentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
