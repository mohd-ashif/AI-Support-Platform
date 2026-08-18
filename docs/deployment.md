# 🌐 SupportAI Platform - Production Deployment Guide

This document provides step-by-step instructions for deploying the **SupportAI Platform** to public cloud production infrastructure using **Vercel** (Next.js Frontend), **Render** (FastAPI Backend), **Neon PostgreSQL** (Relational Database & `pgvector`), **Upstash Redis** (Caching & Rate Limiting), and **Upstash QStash** (Serverless Background Jobs).

---

## 🏛️ 1. Production Architecture

```text
                                  INTERNET
                                     │
                                     ▼
                               ┌───────────┐
                               │  Vercel   │
                               │ Next.js   │
                               │ Frontend  │
                               └─────┬─────┘
                                     │ HTTPS
                                     ▼
                               ┌───────────┐
                               │  Render   │
                               │ FastAPI   │
                               │ Backend   │
                               └─────┬─────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
              ┌──────┐           ┌────────┐          ┌────────┐
              │ Neon │           │ Upstash│          │ QStash │
              │ PG   │           │ Redis  │          │ Jobs   │
              │pgvec │           │ Cache  │          │ Queue  │
              └──────┘           └────────┘          └───┬────┘
                                                         │
                                                         ▼
                                                   Signed Callbacks
                                                   ├── RAG Ingestion
                                                   ├── Web Crawling
                                                   ├── GitHub Sync
                                                   ├── Embeddings
                                                   └── Code Analysis
```

---

## 🛠️ 2. Step-by-Step Deployment Guide

### Phase 1: Database Setup (Neon PostgreSQL)
1. Log in to [Neon.tech](https://neon.tech) and copy your production connection string.
2. Enable `pgvector` extension in Neon SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Run Alembic database migrations:
   ```bash
   alembic upgrade head
   ```

### Phase 2: Upstash Redis & QStash Setup
1. **Upstash Redis**: Create a Redis database instance on [Upstash Console](https://console.upstash.com) and copy the `rediss://...` connection URL.
2. **Upstash QStash**: Log in to Upstash QStash, copy your `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, and `QSTASH_NEXT_SIGNING_KEY`.

### Phase 3: Backend Deployment (Render)
1. Connect your GitHub repository to [Render.com](https://render.com).
2. Create a new **Web Service**:
   - **Environment**: `Python 3.11`
   - **Build Command**: `pip install -r apps/api/requirements.txt`
   - **Start Command**: `uvicorn apps.api.src.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
3. Configure Backend Environment Variables in Render:
   - `DATABASE_URL` (Neon PostgreSQL URL)
   - `REDIS_URL` (Upstash Redis TLS URL)
   - `SECRET_KEY`, `JWT_SECRET_KEY`, `ENCRYPTION_KEY`
   - `GROQ_API_KEY`, `OPENAI_API_KEY`
   - `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
   - `FRONTEND_URL` (Your Vercel domain URL)
   - `ALLOWED_ORIGINS` (Comma-separated allowed origins)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GITHUB_WEBHOOK_SECRET`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

### Phase 4: Frontend Deployment (Vercel)
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Set Root Directory to `apps/web`.
3. Configure Frontend Environment Variables in Vercel:
   - `NEXT_PUBLIC_API_URL`: `https://<your-render-backend-url>.onrender.com`
   - `NEXT_PUBLIC_APP_URL`: `https://<your-vercel-domain>.vercel.app`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_live_...`
4. Deploy the application.

---

## 🔐 3. OAuth & Webhook Callbacks

| Service | Setting Name | Production Callback URL |
| :--- | :--- | :--- |
| **Google OAuth** | Authorized Redirect URI | `https://<render-backend>/auth/google/callback` |
| **GitHub OAuth** | Authorization Callback URL | `https://<render-backend>/integrations/github/callback` |
| **GitHub Webhook** | Webhook URL | `https://<render-backend>/integrations/github/webhook` |
| **Stripe Webhook** | Webhook Endpoint | `https://<render-backend>/billing/webhook` |
| **Upstash QStash** | Callback Target | `https://<render-backend>/api/v1/jobs/handle/{job_type}` |

---

## 🚑 4. Rollback & Troubleshooting Procedure

### Rollback Strategy
1. **Frontend**: Go to Vercel Deployments dashboard $\rightarrow$ Select previous stable deployment $\rightarrow$ Click **Instant Rollback**.
2. **Backend**: Go to Render Web Service dashboard $\rightarrow$ Select **Deploys** $\rightarrow$ Click **Rollback to this build**.
3. **Database**: Alembic supports versioned schema rollbacks:
   ```bash
   alembic downgrade -1
   ```

### Health Probes
- `GET /health` - Basic API service check (`200 OK`)
- `GET /health/live` - Liveness probe (`200 OK`)
- `GET /health/ready` - Readiness probe verifying Neon DB and Redis connectivity without exposing secrets.
