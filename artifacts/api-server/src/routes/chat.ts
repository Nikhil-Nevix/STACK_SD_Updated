import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ticketsTable, auditLogsTable } from "@workspace/db";

const router: IRouter = Router();

const USE_CASE_MAP: Record<string, string> = {
  sharepoint: "sharepoint_access",
  "sharepoint access": "sharepoint_access",
  "sharepoint admin": "sharepoint_admin",
  license: "license_o365",
  "office 365": "license_o365",
  o365: "license_o365",
  bluebeam: "license_bluebeam",
  adobe: "license_adobe",
  "distribution list": "dl_update",
  dl: "dl_update",
  windows: "windows_troubleshooting",
  password: "windows_troubleshooting",
  printer: "windows_troubleshooting",
};

function detectUseCase(message: string): string {
  const lower = message.toLowerCase();
  for (const [key, value] of Object.entries(USE_CASE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return "windows_troubleshooting";
}

router.post("/v1/chat/message", async (req, res): Promise<void> => {
  const { user_id, session_id, message, platform, context } = req.body;

  if (!user_id || !session_id || !message || !platform) {
    res.status(400).json({ error: "user_id, session_id, message, and platform are required" });
    return;
  }

  const lower = message.toLowerCase();

  if (lower.includes("hi") || lower.includes("hello") || lower.includes("help")) {
    res.json({
      reply: "Hello! I am STACK AI, your IT service desk assistant by Jade Global. I can help you with SharePoint access, software licenses, distribution list updates, and Windows troubleshooting. How can I assist you today?",
      ticket_id: null,
      action_taken: "welcome_message",
      requires_input: true,
      input_prompt: "Please describe your issue in detail.",
      session_id,
    });
    return;
  }

  const use_case = detectUseCase(message);
  const [ticket] = await db.insert(ticketsTable).values({
    title: message.substring(0, 200),
    description: message,
    use_case: use_case as any,
    priority: "medium",
    source: platform as any,
    status: "open",
    sla_status: "safe",
    sla_breach_predicted: false,
  }).returning();

  await db.insert(auditLogsTable).values({
    ticket_id: ticket.ticket_id,
    event_type: "ticket_created",
    actor: user_id,
    actor_type: "user",
    details: { platform, session_id },
  });

  res.json({
    reply: `Your request has been received and ticket #${ticket.ticket_id.slice(0, 8)} has been created. Our AI is processing your request for ${use_case.replace(/_/g, " ")}. You will be notified once resolved.`,
    ticket_id: ticket.ticket_id,
    action_taken: "ticket_created",
    requires_input: false,
    input_prompt: null,
    session_id,
  });
});

export default router;
