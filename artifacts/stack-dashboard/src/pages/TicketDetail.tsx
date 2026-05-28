import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetTicket,
  useResolveTicket,
  useEscalateTicket,
  useUpdateTicket,
  useAddTicketNote,
  useGetTicketTimeline,
  getGetTicketQueryKey,
  getGetTicketTimelineQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SLABadge } from "@/components/common/SLABadge";
import { StatusTag } from "@/components/common/StatusTag";
import { useToast } from "@/hooks/use-toast";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import { ArrowLeft, Zap, ChevronUp, CheckCircle2, ChevronDown, Terminal } from "lucide-react";

function ScoreBar({ label, score }: { label: string; score: number | null | undefined }) {
  const pct = Math.round((score ?? 0) * 100);
  const color = pct >= 85 ? "#10b981" : pct >= 60 ? "#F47920" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function ConfidenceGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? "#10b981" : pct >= 60 ? "#F47920" : "#ef4444";
  const data = [{ value: pct, fill: color }, { value: 100 - pct, fill: "#f1f5f9" }];
  return (
    <div className="relative w-32 h-32 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={data} startAngle={90} endAngle={-270}>
          <RadialBar dataKey="value" background={false} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-xs text-muted-foreground">confidence</span>
      </div>
    </div>
  );
}

export default function TicketDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);

  const { data: ticket, isLoading } = useGetTicket(id, {
    query: { queryKey: getGetTicketQueryKey(id), enabled: !!id },
  });
  const { data: timeline } = useGetTicketTimeline(id, {
    query: { queryKey: getGetTicketTimelineQueryKey(id), enabled: !!id && showTimeline },
  });

  const resolveTicket = useResolveTicket();
  const escalateTicket = useEscalateTicket();
  const updateTicket = useUpdateTicket();
  const addNote = useAddTicketNote();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetTicketTimelineQueryKey(id) });
  };

  const handleResolve = () => {
    resolveTicket.mutate({ id }, { onSuccess: () => { toast({ title: "AI resolution triggered" }); invalidate(); } });
  };
  const handleEscalate = () => {
    escalateTicket.mutate({ id, data: { reason: "Manual escalation" } }, {
      onSuccess: () => { toast({ title: "Escalated" }); invalidate(); }
    });
  };
  const handleClose = () => {
    updateTicket.mutate({ id, data: { status: "closed" } }, {
      onSuccess: () => { toast({ title: "Ticket closed" }); invalidate(); }
    });
  };
  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote.mutate({ id, data: { content: note, note_type: "human_note" } }, {
      onSuccess: () => { toast({ title: "Note added" }); setNote(""); invalidate(); }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button className="mt-4" onClick={() => setLocation("/tickets")}>Back to Tickets</Button>
      </div>
    );
  }

  const ai = ticket.ai_resolution;
  const notes = ticket.notes ?? [];
  const isOpen = ticket.status === "open" || ticket.status === "in_progress";

  const DECISION_LABELS: Record<string, { label: string; color: string }> = {
    auto_resolve: { label: "Auto Resolve", color: "#10b981" },
    review_after: { label: "Review After", color: "#F47920" },
    escalate: { label: "Escalate", color: "#ef4444" },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/tickets")} className="mt-1 flex-shrink-0">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">{ticket.title}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">{ticket.freshservice_ticket_id || ticket.ticket_id?.slice(0, 8)}</span>
            <StatusTag type="status" value={ticket.status} />
            <StatusTag type="priority" value={ticket.priority} />
            <SLABadge status={ticket.sla_status} />
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {isOpen && (
            <>
              <Button size="sm" className="bg-[#F47920] hover:bg-[#F47920]/90 text-white gap-1" onClick={handleResolve} disabled={resolveTicket.isPending} data-testid="button-ai-resolve">
                <Zap className="w-3.5 h-3.5" /> AI Resolve
              </Button>
              <Button size="sm" variant="outline" className="border-amber-400 text-amber-600 gap-1" onClick={handleEscalate} data-testid="button-escalate">
                <ChevronUp className="w-3.5 h-3.5" /> Escalate
              </Button>
              <Button size="sm" variant="outline" onClick={handleClose} data-testid="button-close">
                Close
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info grid */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ticket Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Use Case</p>
                  <p className="font-medium mt-0.5">{ticket.use_case?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Source</p>
                  <p className="font-medium mt-0.5">{ticket.source}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Assigned Agent</p>
                  <p className="font-medium mt-0.5">{ticket.assigned_agent_name || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">User Email</p>
                  <p className="font-medium mt-0.5">{(ticket as any).user_email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium mt-0.5">{new Date(ticket.created_at).toLocaleString()}</p>
                </div>
                {ticket.closed_at && (
                  <div>
                    <p className="text-muted-foreground text-xs">Closed</p>
                    <p className="font-medium mt-0.5">{new Date(ticket.closed_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
              {ticket.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-muted-foreground text-xs mb-1">Description</p>
                  <p className="text-sm">{ticket.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Resolution Panel */}
          {ai ? (
            <Card className="border-0 shadow-sm border-l-4 border-l-[#0097A7]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#F47920]" /> AI Resolution Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-6">
                  <ConfidenceGauge score={ai.confidence_score} />
                  <div className="flex-1 space-y-3">
                    <ScoreBar label="Intent Clarity (30%)" score={ai.intent_clarity_score} />
                    <ScoreBar label="SOP Match (35%)" score={ai.sop_match_score} />
                    <ScoreBar label="Historical Success (25%)" score={ai.historical_success_score} />
                    <ScoreBar label="Input Completeness (10%)" score={ai.input_completeness_score} />
                  </div>
                </div>

                {ai.decision && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Decision:</span>
                    <span className="text-sm font-semibold px-2 py-0.5 rounded-full" style={{
                      backgroundColor: (DECISION_LABELS[ai.decision]?.color ?? "#6b7280") + "20",
                      color: DECISION_LABELS[ai.decision]?.color ?? "#6b7280",
                    }}>
                      {DECISION_LABELS[ai.decision]?.label ?? ai.decision}
                    </span>
                  </div>
                )}

                {ai.resolution_steps?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">Resolution Steps</p>
                    <ol className="space-y-1.5">
                      {ai.resolution_steps.map((step: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {ai.execution_output && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> Execution Output</p>
                    <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{ai.execution_output}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : isOpen ? (
            <Card className="border-0 shadow-sm border-dashed">
              <CardContent className="p-6 text-center">
                <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No AI analysis yet</p>
                <Button size="sm" className="mt-3 bg-[#F47920] hover:bg-[#F47920]/90 text-white gap-1" onClick={handleResolve}>
                  <Zap className="w-3.5 h-3.5" /> Trigger AI Resolution
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Notes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes ({notes.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="resize-none text-sm"
                  rows={2}
                  data-testid="input-note"
                />
                <Button size="sm" className="self-end bg-[#1B3A6B] hover:bg-[#1B3A6B]/90 text-white" onClick={handleAddNote} disabled={addNote.isPending || !note.trim()} data-testid="button-add-note">
                  Add
                </Button>
              </div>
              {notes.length > 0 && (
                <div className="space-y-3 divide-y">
                  {notes.map((n) => (
                    <div key={n.note_id} className="pt-3 first:pt-0">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span className="font-medium">{n.created_by || "Agent"}</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm">{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — audit trail */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowTimeline(t => !t)}>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                Audit Trail
                <ChevronDown className={`w-4 h-4 transition-transform ${showTimeline ? "rotate-180" : ""}`} />
              </CardTitle>
            </CardHeader>
            {showTimeline && (
              <CardContent className="p-0">
                {!timeline?.length ? (
                  <p className="p-4 text-sm text-muted-foreground">No events recorded</p>
                ) : (
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {timeline.map((log) => (
                      <div key={log.log_id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#0097A7]" />
                          <span className="text-xs font-semibold">{log.event_type.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-3.5">by {log.actor} · {new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
