# 🚀 SupportAI Platform - Enterprise Multi-Tenant AI Customer Support SaaS

**SupportAI Platform** is a production-hardened, multi-tenant AI Customer Support and Knowledge Base SaaS platform built with Next.js 14, FastAPI, Neon PostgreSQL (`pgvector`), Upstash Redis, Upstash QStash, OpenAI / Groq LLMs, and GitHub REST API v3.

---

## 🏛️ Target Production Architecture

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
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       ┌──────┐    ┌────────┐   ┌────────┐
       │ Neon │    │ Upstash│   │ QStash │
       │ PG   │    │ Redis  │   │ Jobs   │
       │pgvec │    │ Cache  │   │ Queue  │
       └──────┘    └────────┘   └───┬────┘
                                    │
                                    ▼
                              Background Jobs
                              ├── RAG Ingestion
                              ├── Web Crawling
                              ├── GitHub Sync
                              ├── Embeddings
                              └── Code Analysis
```

---

## ✨ Core Features & Platform Capabilities

- **🏢 Multi-Tenant SaaS Engine & Isolation**: Server-validated `TenantContext` and `TenantRepository` deriving workspace scope strictly from authenticated JWT tokens to guarantee zero cross-tenant data leakage.
- **🛡️ 5-Role Access Control Matrix (RBAC)**: Fine-grained authorization engine (`Owner`, `Admin`, `Manager`, `Agent`, `Viewer`) with backend permission enforcement and frontend `<Can>` boundary component.
- **🐙 GitHub Developer Ecosystem**: AES-256 encrypted OAuth token storage, repository code ingestion, issue/PR vectorization, and AI Code AST breakdown.
- **📚 Grounded RAG Citation Engine**: 1536-dimensional OpenAI vector embeddings stored in Neon PostgreSQL `pgvector`, Tiktoken semantic chunking, and grounded source attribution with line ranges and document links.
- **💬 Floating Chat Widget & Live Takeover**: Staggered typing indicator, code block copy buttons, markdown rendering, and 1-click agent session takeover via Socket.io streaming.
- **🔒 Production Hardening & Audit Logging**: Structured immutable audit logs (`AuditLog`), Redis token bucket rate limiting (Auth: 5/min, Invites: 10/min, Chat: 30/min), and deactivated session revocation.
- **💳 Stripe Billing & Quotas**: Subscriptions (`Free`, `Starter`, `Enterprise`), Stripe webhooks, and atomic monthly message quota enforcement.

---

## 🛠️ Technology Stack

| Layer | Technology | Key Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 19, TypeScript, TailwindCSS | Dashboard UI, Widget Customization Studio, Live Operator Inbox |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2.0 Async | High-performance async REST API endpoints & WebSocket server |
| **Database** | Neon PostgreSQL 16 + `pgvector` extension | Relational DB & 1536-dim vector similarity search |
| **Caching & Limits** | Upstash Redis (Serverless TLS) | Session caching & rate limiting |
| **Background Jobs** | Upstash QStash | Serverless HTTP webhook background job queue |
| **AI / RAG** | Groq (Llama-3.3-70b) & OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) | LLM reasoning & vector embeddings |

---

## 🚀 Environment Variables & Setup

1. Copy `.env.example` to `.env` (or configure Vercel and Render dashboards):
   ```bash
   cp .env.example .env
   ```
2. See [docs/deployment.md](file:///d:/ashif/Resume%20Projects/AI-Support-Platform/docs/deployment.md) for full production deployment instructions on Vercel and Render.

---

## 🧪 Testing & Verification

The project includes **28 comprehensive automated pytest test suites**:
```bash
cd apps/api
pytest --tb=short
```

Test coverage includes:
- Database Multi-Tenant Isolation & IDOR Prevention
- 5-Role RBAC Authorization Pipeline
- GitHub OAuth Token Encryption & Webhook Signatures
- RAG Vector Retrieval Accuracy & Prompt Injection Protection
- Upstash Redis Rate Limiting & Audit Logging
- Health Probes (`/health`, `/health/live`, `/health/ready`)
