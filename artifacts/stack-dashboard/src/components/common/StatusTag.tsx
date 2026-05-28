import { Badge } from "@/components/ui/badge";

interface StatusTagProps {
  type: "status" | "priority" | "use_case";
  value: string | undefined;
}

export function StatusTag({ type, value }: StatusTagProps) {
  if (!value) return null;

  let className = "bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200";

  if (type === "status") {
    switch (value.toLowerCase()) {
      case "open": className = "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"; break;
      case "in_progress": className = "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200"; break;
      case "auto_resolved": className = "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200"; break;
      case "escalated": className = "bg-red-100 text-red-800 hover:bg-red-200 border-red-200"; break;
      case "closed": className = "bg-slate-200 text-slate-800 hover:bg-slate-300 border-slate-300"; break;
    }
  } else if (type === "priority") {
    switch (value.toLowerCase()) {
      case "low": className = "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"; break;
      case "medium": className = "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"; break;
      case "high": className = "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200"; break;
      case "urgent": className = "bg-red-100 text-red-800 hover:bg-red-200 border-red-200"; break;
    }
  } else if (type === "use_case") {
    className = "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 font-mono text-xs font-normal";
  }

  return (
    <Badge variant="outline" className={className}>
      {value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
    </Badge>
  );
}
