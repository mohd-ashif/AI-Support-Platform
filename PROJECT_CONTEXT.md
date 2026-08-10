# SupportAI — Multi-Tenant AI Customer-Support SaaS Platform

## Product Summary
Businesses sign up, add a website/business profile, choose a subscription plan, then get a dashboard where they: import knowledge sources (website crawl + file upload), customize an embeddable AI chat widget, get an embed snippet, manage an inbox of AI/human conversations, view analytics, and manage team/billing/API keys/webhooks.

## Monorepo Layout
```
/apps
  /web       -> Next.js 15 (App Router) dashboard, React 19, TypeScript
  /widget    -> standalone embeddable chat widget (small React or vanilla bundle, served separately from the dashboard, NOT auth-gated)
  /api       -> Python FastAPI backend
/packages
  /shared-types  -> TS types shared between web and widget
  /ui            -> shared Shadcn-based React components
/infra
  docker-compose.yml
  /workers   -> Celery / APScheduler / BullMQ job definitions
```

## Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, TailwindCSS, Shadcn UI, React Query (server state) + Redux Toolkit (client/UI state only — do not duplicate server cache in Redux), React Hook Form + Zod, Framer Motion, Socket.io-client
- **Backend**: Python FastAPI, JWT auth + Google OAuth, RBAC (roles: owner/admin/agent)
- **AI**: LangGraph + LangChain + OpenAI, Redis for short-term conversation memory, pgvector on Neon Postgres for embeddings (MVP choice — do not add Qdrant unless explicitly requested)
- **Queue/Jobs**: Celery with Redis broker (used instead of BullMQ since backend is Python)
- **Storage**: Cloudinary free tier for logos and uploaded document originals
- **Database**: Neon Postgres (serverless Postgres)
- **Realtime**: Socket.io (FastAPI ASGI-mounted server)

## Multi-Tenancy Rule (Critical)
Every table that holds tenant data has a `workspace_id` column. Every query in every router must filter by `workspace_id` derived from the authenticated user's session — never trust a `workspace_id` passed in the request body/query string for authenticated dashboard routes. Add Postgres Row-Level Security policies keyed on `workspace_id` as a second line of defense.

## Two Separate Security Surfaces (Critical)
1. **Dashboard API** (`apps/web` -> `apps/api`): authenticated via JWT, user belongs to a workspace via `team_members` table.
2. **Public Widget API** (`apps/widget` -> `apps/api`): NOT authenticated via user JWT. Authenticated via a public Workspace ID + rate limiting only. This is exposed on third-party websites, so it must never expose any endpoint that can read another workspace's data, and must never accept the dashboard JWT.

## Core DB Schema
- `users(id, email, password_hash, google_id, name, avatar_url, created_at)`
- `businesses(id, name, website_url, industry, logo_url, owner_user_id, created_at)`
- `workspaces(id, business_id, workspace_uuid, plan_id, status, created_at)`
- `team_members(id, workspace_id, user_id, role, invited_at, joined_at)`
- `plans(id, name, price_monthly, price_annual, message_limit, seat_limit, features_json)`
- `subscriptions(id, workspace_id, plan_id, stripe_customer_id, stripe_sub_id, status, current_period_end)`
- `sources_web(id, workspace_id, url, status, page_count, last_crawled_at)`
- `sources_files(id, workspace_id, filename, storage_url, mime_type, status, text_preview, imported_at)`
- `knowledge_chunks(id, workspace_id, source_type, source_id, content, embedding vector, token_count)`
- `widget_configs(id, workspace_id, brand_name, tagline, logo_url, primary_color, greeting_message, content_cards_json, updated_at)`
- `conversations(id, workspace_id, visitor_id, channel, status, assigned_agent_id, created_at)`
- `messages(id, conversation_id, sender_type, content, created_at)`
- `analytics_daily(id, workspace_id, date, conversations_count, ai_resolved_count, avg_response_ms, csat_avg)`
- `api_keys(id, workspace_id, key_hash, label, created_at, last_used_at)`
- `webhooks(id, workspace_id, url, events_json, secret)`

## Code Conventions
- **FastAPI**: routers per domain (auth, workspaces, sources, widget, inbox, analytics, billing, admin), Pydantic v2 schemas, dependency-injected DB sessions, all business logic in a service layer (not in route handlers).
- **Frontend**: App Router route groups `(dashboard)` and `(auth)`, Shadcn UI components, Zod schemas shared with RHF, React Query hooks per domain in `/lib/queries`.
- **Every new feature**: write a short README section + at least one backend test (`pytest`) + confirm the frontend builds with no TS errors before reporting done.
- **After each task**: give files changed, how to run/test locally, and any manual `.env` values needed.
