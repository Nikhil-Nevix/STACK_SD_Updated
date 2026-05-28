import { useState } from "react";
import {
  useListSops,
  useGetSop,
  useUpdateSop,
  useCreateSop,
  useSearchSops,
  getListSopsQueryKey,
  getGetSopQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, BookOpen, Plus, Check, Edit3, ToggleLeft, ToggleRight } from "lucide-react";

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

function CreateSopForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSop = useCreateSop();
  const [form, setForm] = useState({ title: "", use_case: "", content: "", version: "1.0" });

  const handleSubmit = () => {
    if (!form.title || !form.use_case || !form.content) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    createSop.mutate({ data: form as any }, {
      onSuccess: () => {
        toast({ title: "SOP created" });
        queryClient.invalidateQueries({ queryKey: getListSopsQueryKey() });
        onSuccess();
      },
    });
  };

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-[#F47920]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">New SOP</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="text-sm" data-testid="input-sop-title" />
          <Select value={form.use_case} onValueChange={v => setForm(f => ({ ...f, use_case: v }))}>
            <SelectTrigger className="text-sm" data-testid="select-sop-usecase"><SelectValue placeholder="Use Case" /></SelectTrigger>
            <SelectContent>{USE_CASES.map(uc => <SelectItem key={uc} value={uc}>{USE_CASE_LABELS[uc]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Input placeholder="Version (e.g. 1.0)" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} className="text-sm w-40" data-testid="input-sop-version" />
        <Textarea
          placeholder="SOP content (markdown supported)..."
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          rows={6}
          className="text-sm font-mono resize-none"
          data-testid="input-sop-content"
        />
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white gap-1" onClick={handleSubmit} disabled={createSop.isPending} data-testid="button-create-sop">
            <Check className="w-3.5 h-3.5" /> Create SOP
          </Button>
          <Button size="sm" variant="outline" onClick={onSuccess}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SopDetail({ sopId }: { sopId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: sop, isLoading } = useGetSop(sopId, {
    query: { queryKey: getGetSopQueryKey(sopId), enabled: !!sopId },
  });
  const updateSop = useUpdateSop();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  const handleToggleActive = () => {
    if (!sop) return;
    updateSop.mutate({ id: sopId, data: { is_active: !sop.is_active } }, {
      onSuccess: () => {
        toast({ title: `SOP ${sop.is_active ? "deactivated" : "activated"}` });
        queryClient.invalidateQueries({ queryKey: getGetSopQueryKey(sopId) });
        queryClient.invalidateQueries({ queryKey: getListSopsQueryKey() });
      }
    });
  };

  const handleSaveContent = () => {
    updateSop.mutate({ id: sopId, data: { content } }, {
      onSuccess: () => {
        toast({ title: "SOP updated" });
        queryClient.invalidateQueries({ queryKey: getGetSopQueryKey(sopId) });
        setEditing(false);
      }
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!sop) return <p className="text-muted-foreground">SOP not found</p>;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{sop.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs border-[#0097A7]/30 text-[#0097A7]">{USE_CASE_LABELS[sop.use_case] || sop.use_case}</Badge>
              <span className="text-xs text-muted-foreground">v{sop.version}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sop.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                {sop.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={handleToggleActive} data-testid="button-toggle-sop">
              {sop.is_active ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
              {sop.is_active ? "Deactivate" : "Activate"}
            </Button>
            {!editing && (
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { setEditing(true); setContent(sop.content); }} data-testid="button-edit-sop">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {editing ? (
          <div className="space-y-3">
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={14}
              className="text-sm font-mono resize-none"
              data-testid="input-edit-sop-content"
            />
            <div className="flex gap-2">
              <Button size="sm" className="bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white" onClick={handleSaveContent} disabled={updateSop.isPending} data-testid="button-save-sop">Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-foreground max-h-[500px] overflow-y-auto">{sop.content}</pre>
        )}
      </CardContent>
    </Card>
  );
}

export default function SOPManager() {
  const { data: sops, isLoading } = useListSops({ query: { queryKey: getListSopsQueryKey() } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = (sops ?? []).filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.use_case.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SOP Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage standard operating procedures for AI resolution</p>
        </div>
        <Button size="sm" className="bg-[#F47920] hover:bg-[#F47920]/90 text-white gap-1.5" onClick={() => { setShowCreate(true); setSelectedId(null); }} data-testid="button-new-sop">
          <Plus className="w-4 h-4" /> New SOP
        </Button>
      </div>

      {showCreate && <CreateSopForm onSuccess={() => setShowCreate(false)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SOP List */}
        <Card className="border-0 shadow-sm lg:col-span-1 self-start">
          <CardHeader className="pb-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search SOPs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
                data-testid="input-sop-search"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-3 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No SOPs found</div>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filtered.map(s => (
                  <button
                    key={s.sop_id}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors ${selectedId === s.sop_id ? "bg-[#1B3A6B]/5 border-l-2 border-l-[#1B3A6B]" : ""}`}
                    onClick={() => { setSelectedId(s.sop_id); setShowCreate(false); }}
                    data-testid={`button-sop-${s.sop_id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{USE_CASE_LABELS[s.use_case] || s.use_case} · v{s.version}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {s.is_active
                          ? <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 block" />
                          : <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-muted-foreground block" />
                        }
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SOP Detail */}
        <div className="lg:col-span-2">
          {selectedId ? (
            <SopDetail sopId={selectedId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-3 opacity-30" />
              <p>Select a SOP to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
