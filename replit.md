# STACK Service Desk AI Solution

Enterprise IT service desk automation platform by Jade Global Software Pvt Ltd. Automates ticket resolution, tracks SLA compliance, and provides AI-driven insights for IT operations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/stack-dashboard run dev` — run the React dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui + Wouter + TanStack Query + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/stack-dashboard/` — React SPA (Vite), served at `/`
- `artifacts/stack-dashboard/src/pages/` — 9 page components (Login, Dashboard, Tickets, TicketDetail, Logs, Reports, ROIDashboard, Admin, SOPManager)
- `artifacts/stack-dashboard/src/components/` — shared UI (AppLayout, StatusTag, SLABadge, etc.)
- `artifacts/stack-dashboard/src/lib/auth.ts` — token helpers (getToken, setToken, clearToken, isAuthenticated)
- `artifacts/api-server/src/routes/` — Express route handlers for all resources
- `lib/db/src/schema/index.ts` — source-of-truth DB schema (Drizzle)
- `lib/api-spec/` — OpenAPI spec; run codegen after changes

## Architecture decisions

- Contract-first API: OpenAPI spec → generated React Query hooks + Zod schemas via Orval
- Simple token auth: base64(agent_id:timestamp), stored in localStorage as `stack_token`
- All API routes under `/api/v1/` prefix; Express mounts router at `/api`
- Wouter for routing (lightweight); protected routes use a `ProtectedRoute` wrapper + `RedirectTo` helper
- Brand: Navy #1B3A6B sidebar, Orange #F47920 accent/active, Cyan #0097A7 highlights

## Product

**9 main areas:**
1. **Login** — JGSL-branded sign-in (use `admin@jgsl.com` with any password)
2. **Dashboard** — KPI tiles, ticket volume charts, SLA compliance gauge, recent activity
3. **Tickets** — Full ticket list with filters by status/priority/use-case, search, pagination
4. **Ticket Detail** — Timeline, AI resolution log, notes, status transitions
5. **Logs** — API call logs, PowerShell execution logs with severity filtering
6. **Reports** — Weekly/monthly SLA, MTTR, auto-resolution, use-case breakdown charts
7. **ROI Dashboard** — Cost savings, hours saved, efficiency metrics, configurable parameters
8. **Admin** — SLA thresholds, agent management, system config
9. **SOP Manager** — Standard Operating Procedures with rich-text editing per use case

**7 use cases:** SharePoint access, SharePoint admin, Bluebeam license, Adobe license, O365 license, DL update, Windows troubleshooting

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Auth token is `stack_token` in localStorage; any API call without it gets 401 → redirected to login
- ROI Dashboard imports `Cell` from recharts — do NOT define a local `Cell` function in that file (name conflict)
- StatusTag props: `type` + `value` (not `status`)
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec
- Use `localhost:80/<path>` for curl (proxy), never direct port (e.g. 8080)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- DB seed data: 5 agents, 25 tickets, SOPs, SLA configs, ROI metrics, audit/API logs
