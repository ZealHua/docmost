# Docmost - Project Context

## Project Overview

**Docmost** is an open-source collaborative wiki and documentation software. It is built as a monorepo using **pnpm workspaces** and **Nx** for task orchestration.

### Architecture

| Component | Location | Tech Stack |
|-----------|----------|------------|
| **Frontend (Client)** | `apps/client` | React 18, Vite, TypeScript, Mantine UI v8, TanStack Query, Jotai, Tiptap, React Router |
| **Backend (Server)** | `apps/server` | NestJS v11, Fastify, TypeScript, Kysely (query builder), PostgreSQL, Redis, BullMQ, Socket.io |
| **Shared Packages** | `packages/*` | `@docmost/editor-ext` (Tiptap extensions), `ee` (Enterprise features) |

### Key Features

- Real-time collaboration (Yjs + Hocuspocus)
- Rich text editor (Tiptap/ProseMirror)
- Diagrams (Draw.io, Excalidraw, Mermaid)
- Spaces and permissions management
- Full-text search (Typesense/Algolia)
- File attachments
- AI-powered features (RAG, embeddings, chat)
- Multi-language support (10+ languages via Crowdin)

---

## Development Setup

### Prerequisites

- **Node.js** >= 22
- **PostgreSQL** >= 16 (with pgvector extension for AI features)
- **Redis** >= 7

### Installation

```bash
# Install pnpm globally
npm install -g pnpm@10.4.0

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your local DB/Redis credentials

# Build editor-ext FIRST (required dependency)
pnpm nx run @docmost/editor-ext:build
```

### Environment Configuration

Key `.env` variables:

```bash
APP_URL=http://localhost:3000
PORT=3000
APP_SECRET=<32+ character secret>
DATABASE_URL=postgresql://postgres:password@localhost:5432/docmost?schema=public
REDIS_URL=redis://127.0.0.1:6379

# AI Provider (ZhipuAI / OpenAI-compatible)
AI_DRIVER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_COMPATIBLE_API_KEY=<your-key>
OPENAI_COMPATIBLE_COMPLETION_MODEL=glm-4-flash
OPENAI_COMPATIBLE_EMBEDDING_MODEL=embedding-3
```

---

## Key Commands

Run all commands from the **repository root**:

| Action | Command |
|--------|---------|
| **Start Full Dev Stack** | `pnpm run dev` (runs client + server concurrently) |
| **Start Client Only** | `pnpm nx run client:dev` |
| **Start Server Only** | `pnpm nx run server:dev` |
| **Build All** | `pnpm build` |
| **Build Client** | `pnpm nx run client:build` |
| **Build Server** | `pnpm nx run server:build` |
| **Build Editor-Ext** | `pnpm nx run @docmost/editor-ext:build` |
| **Lint Client** | `pnpm --filter client run lint` |
| **Lint Server** | `pnpm --filter server run lint` |
| **Format Client** | `pnpm --filter client run format` |
| **Format Server** | `pnpm --filter server run format` |
| **Test Server** | `pnpm --filter server test` |
| **Clean Build Artifacts** | `pnpm clean` |

---

## Database & Migrations

Docmost uses **Kysely** for type-safe SQL queries (no ORM).

### Migration Commands

```bash
# Run all pending migrations
pnpm nx run server:migration:latest

# Create new migration
pnpm nx run server:migration:create <migration_name>

# Revert last migration
pnpm nx run server:migration:down

# Reset all migrations
pnpm nx run server:migration:reset

# CRITICAL: Regenerate TypeScript types after schema changes
pnpm nx run server:migration:codegen
```

### Important

- **Always run `migration:codegen`** after creating or modifying migrations
- This updates `apps/server/src/database/types/db.d.ts` which powers Kysely's type safety
- The `pageEmbeddings` table uses pgvector (`vector(1024)` type)

---

## Backend Guidelines (`apps/server`)

### Path Aliases

- `@docmost/db/*` → `apps/server/src/database/*`
  ```typescript
  import { dbOrTx } from '@docmost/db/utils';
  import { InsertableWorkspace } from '@docmost/db/types/entity.types';
  ```

### Architecture

- Follow NestJS modular architecture (Controllers, Services, Repositories)
- **Repository Pattern**: All database access must be in `apps/server/src/database/repos/`
- Never write queries directly in Services or Controllers
- Use `@InjectKysely()` from `nestjs-kysely` to inject the database

### Security

- Always validate user permissions via Casl/Guards
- Enforce `workspaceId` filtering on all tenant-specific queries
- Never leak data across workspaces

### Testing

- Write `.spec.ts` files using Jest next to the files they test
- Run tests: `pnpm --filter server test`

---

## Frontend Guidelines (`apps/client`)

### Path Aliases

- `@/*` → `apps/client/src/*`
  ```typescript
  import { Button } from '@/components/ui/button';
  ```

### UI & Styling

- **Prefer Mantine components** (`@mantine/core`) for all UI primitives
- Use Mantine's spacing props (`mt`, `mb`, `w`, `h`) or CSS modules for custom styling
- Icons: `@tabler/icons-react`

### State Management

- **Jotai**: Client-side transient state (sidebar toggles, local preferences)
- **TanStack Query**: Server state (API interactions)
- Never store server state in Jotai

### Rich Text Editor

- Based on **Tiptap** / ProseMirror
- Shared extensions live in `packages/editor-ext`
- Editor components: `apps/client/src/components/editor`

---

## AI Features

### Provider Support

| Provider | Driver | Completion | Embeddings |
|----------|--------|------------|------------|
| ZhipuAI | `openai-compatible` | ✅ `glm-4-flash` | ✅ `embedding-3` (1024 dim) |
| OpenAI | `openai` | ✅ | ✅ |
| Gemini | `gemini` | ✅ | ❌ (not implemented) |
| Ollama | `ollama` | ✅ | ✅ (via `/api/embeddings`) |

### File Locations

- **Backend**: `apps/server/src/ai/`
- **Frontend**: `apps/client/src/features/ai/`

### Key Integration Points

- **AI Queue**: `AI_QUEUE` in Redis (BullMQ)
- **Listeners**: `page.listener.ts` enqueues `PAGE_CREATED`, `PAGE_CONTENT_UPDATED`, etc.
- **Sidebar State**: Set `{ tab: 'ai', isAsideOpen: true }` to open AI panel

---

## Docker Deployment

```bash
# Start full stack with Docker Compose
docker-compose up -d

# The compose file includes:
# - Docmost app (port 3000)
# - PostgreSQL with pgvector (pgvector/pgvector:pg18)
# - Redis
```

### Dockerfile

Multi-stage build:
1. **Builder**: Installs deps and builds all apps
2. **Installer**: Copies dist files and installs production deps only
3. **Runtime**: Runs as non-root `node` user

---

## Enterprise Edition

Enterprise features are in `packages/ee` and licensed separately.

**EE Directories:**
- `apps/server/src/ee`
- `apps/client/src/ee`
- `packages/ee`

---

## Contributing

See [development documentation](https://docmost.com/docs/self-hosting/development)

### Code Style

- **TypeScript**: Strict mode, no `any` unless absolutely necessary
- **Formatting**: Prettier (run `pnpm format` before committing)
- **Linting**: ESLint (run `pnpm lint` before committing)

### Self-Verification Checklist

After making changes:

1. Run formatting: `pnpm --filter <client|server> run format`
2. Run linting: `pnpm --filter <client|server> run lint`
3. Verify TypeScript compilation passes
4. For server changes: run tests `pnpm --filter server test`
5. For DB schema changes: run `pnpm nx run server:migration:codegen`

---

## Additional Resources

- **Website**: https://docmost.com
- **Documentation**: https://docmost.com/docs
- **Twitter/X**: https://twitter.com/DocmostHQ
- **Localization**: Powered by Crowdin
