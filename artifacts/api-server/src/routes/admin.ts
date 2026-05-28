import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  confidenceThresholdsTable,
  slaConfigsTable,
  agentGroupsTable,
  agentGroupMembersTable,
  agentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/admin/thresholds", async (_req, res): Promise<void> => {
  const thresholds = await db.select().from(confidenceThresholdsTable);
  res.json(thresholds.map(t => ({
    threshold_id: t.threshold_id,
    use_case: t.use_case,
    auto_resolve_min: t.auto_resolve_min,
    review_after_min: t.review_after_min,
    updated_at: t.updated_at.toISOString(),
  })));
});

router.patch("/v1/admin/thresholds/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { auto_resolve_min, review_after_min } = req.body;

  const updateData: any = { updated_at: new Date() };
  if (auto_resolve_min !== undefined) updateData.auto_resolve_min = auto_resolve_min;
  if (review_after_min !== undefined) updateData.review_after_min = review_after_min;

  const [threshold] = await db.update(confidenceThresholdsTable).set(updateData).where(eq(confidenceThresholdsTable.threshold_id, id)).returning();
  if (!threshold) {
    res.status(404).json({ error: "Threshold not found" });
    return;
  }

  res.json({
    threshold_id: threshold.threshold_id,
    use_case: threshold.use_case,
    auto_resolve_min: threshold.auto_resolve_min,
    review_after_min: threshold.review_after_min,
    updated_at: threshold.updated_at.toISOString(),
  });
});

router.get("/v1/admin/sla-configs", async (_req, res): Promise<void> => {
  const configs = await db.select().from(slaConfigsTable);
  res.json(configs.map(c => ({
    sla_id: c.sla_id,
    use_case: c.use_case,
    priority: c.priority,
    resolution_hours: c.resolution_hours,
    warning_threshold_percent: c.warning_threshold_percent,
    updated_at: c.updated_at.toISOString(),
  })));
});

router.patch("/v1/admin/sla-configs/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { resolution_hours, warning_threshold_percent } = req.body;

  const updateData: any = { updated_at: new Date() };
  if (resolution_hours !== undefined) updateData.resolution_hours = resolution_hours;
  if (warning_threshold_percent !== undefined) updateData.warning_threshold_percent = warning_threshold_percent;

  const [config] = await db.update(slaConfigsTable).set(updateData).where(eq(slaConfigsTable.sla_id, id)).returning();
  if (!config) {
    res.status(404).json({ error: "SLA config not found" });
    return;
  }

  res.json({
    sla_id: config.sla_id,
    use_case: config.use_case,
    priority: config.priority,
    resolution_hours: config.resolution_hours,
    warning_threshold_percent: config.warning_threshold_percent,
    updated_at: config.updated_at.toISOString(),
  });
});

router.get("/v1/admin/groups", async (_req, res): Promise<void> => {
  const groups = await db.select().from(agentGroupsTable);
  const members = await db.select({
    member_id: agentGroupMembersTable.member_id,
    group_id: agentGroupMembersTable.group_id,
    agent_id: agentGroupMembersTable.agent_id,
    priority_order: agentGroupMembersTable.priority_order,
    full_name: agentsTable.full_name,
    email: agentsTable.email,
  }).from(agentGroupMembersTable)
    .innerJoin(agentsTable, eq(agentGroupMembersTable.agent_id, agentsTable.agent_id));

  res.json(groups.map(g => ({
    group_id: g.group_id,
    group_name: g.group_name,
    use_case: g.use_case,
    assignment_mode: g.assignment_mode,
    freshservice_group_id: g.freshservice_group_id ?? null,
    members: members
      .filter(m => m.group_id === g.group_id)
      .sort((a, b) => a.priority_order - b.priority_order)
      .map(m => ({
        member_id: m.member_id,
        agent_id: m.agent_id,
        full_name: m.full_name,
        email: m.email,
        priority_order: m.priority_order,
      })),
  })));
});

router.patch("/v1/admin/groups/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { assignment_mode } = req.body;

  const [group] = await db.update(agentGroupsTable).set({ assignment_mode }).where(eq(agentGroupsTable.group_id, id)).returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json({
    group_id: group.group_id,
    group_name: group.group_name,
    use_case: group.use_case,
    assignment_mode: group.assignment_mode,
    freshservice_group_id: group.freshservice_group_id ?? null,
    members: [],
  });
});

router.get("/v1/admin/agents", async (_req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable);
  res.json(agents.map(a => ({
    agent_id: a.agent_id,
    email: a.email,
    full_name: a.full_name,
    role: a.role,
    freshservice_agent_id: a.freshservice_agent_id ?? null,
    is_active: a.is_active,
    created_at: a.created_at.toISOString(),
  })));
});

router.post("/v1/admin/agents", async (req, res): Promise<void> => {
  const { email, full_name, role = "agent", freshservice_agent_id } = req.body;

  if (!email || !full_name) {
    res.status(400).json({ error: "email and full_name are required" });
    return;
  }

  const [agent] = await db.insert(agentsTable).values({
    email,
    full_name,
    role,
    freshservice_agent_id,
    is_active: true,
  }).returning();

  res.status(201).json({
    agent_id: agent.agent_id,
    email: agent.email,
    full_name: agent.full_name,
    role: agent.role,
    freshservice_agent_id: agent.freshservice_agent_id ?? null,
    is_active: agent.is_active,
    created_at: agent.created_at.toISOString(),
  });
});

router.patch("/v1/admin/agents/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { full_name, role, is_active } = req.body;

  const updateData: any = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (role !== undefined) updateData.role = role;
  if (is_active !== undefined) updateData.is_active = is_active;

  const [agent] = await db.update(agentsTable).set(updateData).where(eq(agentsTable.agent_id, id)).returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json({
    agent_id: agent.agent_id,
    email: agent.email,
    full_name: agent.full_name,
    role: agent.role,
    freshservice_agent_id: agent.freshservice_agent_id ?? null,
    is_active: agent.is_active,
    created_at: agent.created_at.toISOString(),
  });
});

export default router;
