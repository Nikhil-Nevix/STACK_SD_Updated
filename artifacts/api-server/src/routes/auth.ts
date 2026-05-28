import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/v1/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.email, email))
    .limit(1);

  if (!agent || !agent.is_active) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = Buffer.from(`${agent.agent_id}:${Date.now()}`).toString("base64");

  res.json({
    token,
    agent: {
      agent_id: agent.agent_id,
      email: agent.email,
      full_name: agent.full_name,
      role: agent.role,
      freshservice_agent_id: agent.freshservice_agent_id,
      is_active: agent.is_active,
      created_at: agent.created_at.toISOString(),
    },
  });
});

router.get("/v1/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const agentId = decoded.split(":")[0];

    const [agent] = await db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.agent_id, agentId))
      .limit(1);

    if (!agent) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    res.json({
      agent_id: agent.agent_id,
      email: agent.email,
      full_name: agent.full_name,
      role: agent.role,
      freshservice_agent_id: agent.freshservice_agent_id,
      is_active: agent.is_active,
      created_at: agent.created_at.toISOString(),
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
