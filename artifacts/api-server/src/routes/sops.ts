import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sopsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/v1/sops", async (_req, res): Promise<void> => {
  const sops = await db.select().from(sopsTable).orderBy(sopsTable.title);
  res.json(sops.map(s => ({
    sop_id: s.sop_id,
    title: s.title,
    use_case: s.use_case,
    content: s.content,
    version: s.version,
    is_active: s.is_active,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at ? s.updated_at.toISOString() : null,
  })));
});

router.post("/v1/sops", async (req, res): Promise<void> => {
  const { title, use_case, content, version = "1.0" } = req.body;

  if (!title || !use_case || !content) {
    res.status(400).json({ error: "title, use_case, and content are required" });
    return;
  }

  const [sop] = await db.insert(sopsTable).values({ title, use_case, content, version, is_active: true }).returning();
  res.status(201).json({
    sop_id: sop.sop_id,
    title: sop.title,
    use_case: sop.use_case,
    content: sop.content,
    version: sop.version,
    is_active: sop.is_active,
    created_at: sop.created_at.toISOString(),
    updated_at: sop.updated_at ? sop.updated_at.toISOString() : null,
  });
});

router.post("/v1/sops/search", async (req, res): Promise<void> => {
  const { query, use_case } = req.body;

  const conditions: any[] = [];
  if (query) conditions.push(ilike(sopsTable.content, `%${query}%`));
  if (use_case) conditions.push(eq(sopsTable.use_case, use_case));

  const sops = await db.select().from(sopsTable).where(
    conditions.length > 0 ? and(...conditions) : undefined
  ).limit(10);

  res.json(sops.map(s => ({
    sop_id: s.sop_id,
    title: s.title,
    use_case: s.use_case,
    content: s.content,
    version: s.version,
    is_active: s.is_active,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at ? s.updated_at.toISOString() : null,
  })));
});

router.get("/v1/sops/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [sop] = await db.select().from(sopsTable).where(eq(sopsTable.sop_id, id));
  if (!sop) {
    res.status(404).json({ error: "SOP not found" });
    return;
  }

  res.json({
    sop_id: sop.sop_id,
    title: sop.title,
    use_case: sop.use_case,
    content: sop.content,
    version: sop.version,
    is_active: sop.is_active,
    created_at: sop.created_at.toISOString(),
    updated_at: sop.updated_at ? sop.updated_at.toISOString() : null,
  });
});

router.patch("/v1/sops/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, content, version, is_active } = req.body;

  const updateData: any = { updated_at: new Date() };
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (version !== undefined) updateData.version = version;
  if (is_active !== undefined) updateData.is_active = is_active;

  const [sop] = await db.update(sopsTable).set(updateData).where(eq(sopsTable.sop_id, id)).returning();
  if (!sop) {
    res.status(404).json({ error: "SOP not found" });
    return;
  }

  res.json({
    sop_id: sop.sop_id,
    title: sop.title,
    use_case: sop.use_case,
    content: sop.content,
    version: sop.version,
    is_active: sop.is_active,
    created_at: sop.created_at.toISOString(),
    updated_at: sop.updated_at ? sop.updated_at.toISOString() : null,
  });
});

router.delete("/v1/sops/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [sop] = await db.update(sopsTable).set({ is_active: false, updated_at: new Date() }).where(eq(sopsTable.sop_id, id)).returning();
  if (!sop) {
    res.status(404).json({ error: "SOP not found" });
    return;
  }

  res.json({ success: true, message: "SOP deactivated" });
});

export default router;
