import { Badge } from "@/components/ui/badge";
import { TicketSlaStatus } from "@workspace/api-client-react";

export function SLABadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let className = "";

  switch (status.toLowerCase()) {
    case 'safe':
      className = "bg-emerald-500 hover:bg-emerald-600 text-white";
      break;
    case 'at_risk':
      className = "bg-amber-500 hover:bg-amber-600 text-white";
      break;
    case 'breached':
      variant = "destructive";
      break;
    default:
      variant = "secondary";
  }

  return (
    <Badge variant={variant} className={className}>
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
}
