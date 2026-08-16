# Tech Stack & Libraries Documentation — SupportAI Platform

This document provides a comprehensive breakdown of all **technologies, frameworks, libraries, tools, database engines, AI models, and infrastructure components** powering the **SupportAI Multi-Tenant Customer Support SaaS Platform**.

---

## 🛠️ 1. Frontend Architecture & Web Stack (`apps/web`)

| Technology / Library | Version | Category | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **Next.js** | `15.0.0-rc.0` | Web Framework | Server-Side Rendering (SSR), App Router architecture, API route proxying, optimized static build generation. |
| **React** | `19.0.0-rc.0` | UI Library | Component-based interactive user interface rendering and virtual DOM management. |
| **TypeScript** | `^5.4.3` | Language | Strict static typing, custom interface definitions, and IDE autocomplete safety. |
| **TailwindCSS** | `^3.4.1` | Styling Engine | Utility-first CSS styling for modern responsive layouts, dark modes, glassmorphism, and custom themes. |
| **Framer Motion** | `^11.0.8` | Animation | Smooth micro-animations, layout transitions, modal popovers, and interactive visual feedback. |
| **Lucide React** | `^0.359.0` | UI Components | Lightweight, accessible vector SVG icon library used across all dashboard navigation and metric cards. |
| **Redux Toolkit** | `^2.2.1` | Global State | Centralized state management for user authentication session, tokens, and active workspace selection. |
| **React Redux** | `^9.1.0` | State Binding | High-performance React hooks (`useSelector`, `useDispatch`) for Redux store integration. |
| **TanStack React Query**| `^5.28.4` | Server State | Query caching, automatic background re-fetching, optimistic updates, and instant real-time query invalidation. |
| **Socket.io Client** | `^4.7.5` | Real-Time WS | WebSocket client for live dashboard metrics updates, real-time visitor chat inbox, and status events. |
| **React Hook Form** | `^7.51.1` | Form Logic | Performant form state handling with minimal re-renders. |
| **Zod** | `^3.22.4` | Data Validation | Schema validation for user inputs, workspace setup forms, and API request payloads. |
| **@hookform/resolvers** | `^3.3.4` | Validation Bridge | Integration layer matching Zod validation schemas directly into React Hook Form controls. |

---

## ⚡ 2. Backend API & Core Engine (`apps/api`)

| Technology / Library | Version | Category | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **FastAPI** | `>=0.110.0` | Web Framework | High-performance async Python REST & ASGI framework with automatic OpenAPI documentation. |
| **Uvicorn** | `>=0.28.0` | ASGI Web Server | Lightning-fast ASGI server powering FastAPI with auto-reload development features. |
| **Python** | `3.11+` | Language Runtime | Core backend runtime powering API endpoints, async workflows, and AI vector data processing. |
| **SQLAlchemy** | `>=2.0.28` | Database ORM | Async ORM mapping database models (`Workspace`, `Conversation`, `Message`, `AnalyticsDaily`). |
| **AsyncPG** | `>=0.29.0` | Database Driver | Ultra-fast asynchronous PostgreSQL database driver for Python. |
| **Alembic** | `>=1.13.1` | Database Migrations | Schema evolution tracking, version control, and database migration execution scripts. |
| **Pydantic** | `>=2.6.4` | Data Schema | Data parsing, type coercion, response serialization, and environment variable configuration settings. |
| **Pydantic Settings** | `>=2.2.1` | Config Management | Type-safe environment variable parsing (`.env` file loader). |
| **Python-SocketIO** | `>=5.11.0` | WebSocket Server | Async Socket.io WebSocket server handling workspace rooms, live inbox messages, and dashboard metric streams. |
| **Redis & PyRedis** | `>=5.0.3` | Cache & Pub/Sub | In-memory key-value cache store and real-time message broker for Socket.io multi-worker event publishing. | 
| **Celery** | `>=5.3.6` | Task Queue | Background task worker queue for asynchronous long-running tasks like website crawling and PDF chunking. |

---

## 🧠 3. AI, RAG Vector Search & Machine Learning

| Technology / Library | Version | Category | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **OpenAI API Client** | `>=1.14.0` | LLM & Embeddings | Integration with `text-embedding-3-small` (1536 dimensions) and `gpt-4o` / `gpt-4o-mini` reasoning engines. |
| **pgvector** | `>=0.2.5` | Vector Indexing | PostgreSQL extension enabling HNSW / IVFFlat vector indexing for similarity search over RAG knowledge chunks. |
| **Tiktoken** | `>=0.6.0` | Tokenizer | OpenAI BPE tokenizer used for precise 250-token semantic chunking of ingested documents and web pages. |
| **Tenacity** | `>=8.2.3` | Retries | Resilience library providing exponential backoff retries for OpenAI API calls and external web requests. |

---

## 📄 4. Document Processing & Ingestion Engines

| Technology / Library | Version | Category | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **PyPDF** | `>=4.0.0` | PDF Parser | Extracting raw text content from uploaded standard PDF files. |
| **pdfplumber** | `>=0.10.4` | Advanced PDF | Extracting complex tabular structures and text positioning from dense PDF documents. |
| **python-docx** | `>=1.1.0` | Word Parser | Parsing Microsoft Word (`.docx`) uploaded documents. |
| **BeautifulSoup4** | `>=4.12.3` | HTML Parser | Sanitizing HTML content and stripping non-essential tags during website domain crawling. |
| **HTTPX** | `>=0.27.0` | Async HTTP Client | Asynchronous web crawler client supporting custom timeout and SSL configurations. |
| **Chardet** | `>=5.2.0` | Character Encoding| Auto-detecting character encodings for varied incoming web pages and document uploads. |
| **Pandas & OpenPYXL** | `>=2.2.0` | Data Processing | Parsing Excel sheets (`.xlsx`) and structured tabular data sources. |
| **Cloudinary Python** | `>=1.38.0` | Media Storage | CDN file hosting and cloud storage for uploaded documents, PDFs, and organization logos. |

---

## 🔒 5. Security, Auth & Data Integrity

| Technology / Library | Version | Category | Description & Purpose |
| :--- | :--- | :--- | :--- |
| **PyJWT** | `>=2.8.0` | Token Auth | Signing and verifying JSON Web Tokens (JWT) for dashboard authentication & API requests. |
| **Passlib & Bcrypt** | `>=1.7.4` | Password Hashing | Secure password hashing using salt-based Bcrypt algorithms. |
| **Python-Multipart** | `>=0.0.9` | Request Parser | Parsing `multipart/form-data` file uploads (PDFs, images) in API endpoints. |
| **Email Validator** | `>=2.0.0` | Validation | Validating email syntax during signup, team invites, and user onboarding. |

---

## 🐳 6. Infrastructure, DevOps & Databases

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Primary Database** | **PostgreSQL (Neon / Supabase / Self-Hosted)** | Relational database storing tenant workspaces, users, conversations, tickets, and pgvector knowledge vectors. |
| **Cache & Event Bus** | **Redis Server 7.0+** | Storing short-lived query response caches and relaying WebSocket events across API workers. |
| **Containerization** | **Docker & Docker Compose** | Orchestrating local multi-container development services (Postgres + pgvector, Redis, FastAPI backend, Celery). |
| **Version Control** | **Git & GitHub** | Source code management with automated CI/CD pipeline triggers. |

---

## 💬 7. Third-Party Embed Chat Widget (`public/widget/loader.js`)

| Technology | Purpose |
| :--- | :--- |
| **Vanilla JavaScript (ES6)** | Lightweight zero-dependency embed script injected via a single HTML `<script>` tag. |
| **WebSockets (Socket.io-client)** | Real-time chat streaming between end visitors on external websites and the SupportAI agent engine. |
| **Scoped CSS Shadow DOM** | Prevents host website CSS styles from polluting or breaking the AI chat widget UI. |

---

> *Last Updated: August 2026 — SupportAI Platform Architecture*
