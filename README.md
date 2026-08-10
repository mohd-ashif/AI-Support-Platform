# SupportAI Monorepo

Multi-tenant AI customer-support SaaS platform.

## Architecture & Layout
- `apps/api`: Python FastAPI backend, SQLAlchemy 2.0 async + Alembic, pgvector, Redis.
- `apps/web`: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, Redux Toolkit + React Query.
- `apps/widget`: Standalone Vite + React embeddable widget.
- `packages/shared-types`: Shared TypeScript definitions.
- `infra/`: Worker configurations and docker-compose.

## Setup Instructions

### Environment Variables
1. Backend (`apps/api`): Create `.env` or set shell variables:
   ```env
   DATABASE_URL=postgresql+asyncpg://<username>:<password>@<neon_host>/<dbname>?sslmode=require
   REDIS_URL=redis://localhost:6379/0
   RABBITMQ_URL=amqp://guest:guest@localhost:5672//
   SECRET_KEY=your_super_secret_jwt_key
   ```
2. Frontend (`apps/web`): Copy `.env.local.example` to `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

### Running Celery Worker (Background Ingestion Queue)
```bash
cd apps/api
celery -A apps.api.src.celery_app worker --loglevel=info
```

### Running Containerized Backend, RabbitMQ & Worker
```bash
docker compose up --build
```
The FastAPI backend will run on `http://localhost:8000`, RabbitMQ Management UI on `http://localhost:15672`, exposing healthcheck `GET /health`.

### Running Frontend Dashboard locally
```bash
cd apps/web
npm install
npm run dev
```
Open `http://localhost:3000` to access the dashboard shell.

### Building Standalone Widget
```bash
cd apps/widget
npm install
npm run build
```
Open `apps/widget/index.html` in browser to test the floating chat bubble widget.
