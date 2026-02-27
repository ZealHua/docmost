# Docmost AI Agent Guidelines

This file (`AGENTS.md`) is designed to provide AI coding agents with the essential context, structure, and operational rules required to work effectively within the Docmost repository.

## 1. Repository Overview & Architecture

Docmost is an open-source collaborative workspace platform with integrated AI capabilities. The repository is a monorepo managed by `pnpm` workspaces and `nx`.

### Tech Stack
*   **Frontend (`apps/client`)**: React 18, Vite, TypeScript.
    *   **UI/Styling**: Mantine UI (v8), PostCSS, Tabler Icons.
    *   **State Management**: Jotai (global client state), React Query (server state).
    *   **Rich Text Editor**: Tiptap / ProseMirror.
    *   **Forms & Validation**: Mantine Form + Zod.
    *   **Routing**: React Router.
    *   **AI Integration**: LangGraph SDK client for agent-based interactions.
*   **Backend (`apps/server`)**: NestJS (v11), Fastify, TypeScript.
    *   **Database**: PostgreSQL with pgvector extension for RAG.
    *   **Query Builder**: Kysely (No ORM).
    *   **Queues & Caching**: Redis (via BullMQ).
    *   **WebSockets**: Socket.io + Redis Adapter.
    *   **AI Module**: OpenAI-compatible providers (GLM, DeepSeek, MiniMax), RAG with pgvector, web search via Serper API.
    *   **Memory**: Mem0 integration for long-term conversational memory.
*   **Agent Gateway (`apps/agent-gateway`)**: Python/LangGraph-based AI agent system.
    *   **Framework**: LangGraph (v1.0.6+), LangChain (v1.2.3+).
    *   **API**: FastAPI (v0.115.0+).
    *   **Features**: Sandboxed code execution, MCP tool integration, subagent delegation, persistent memory.
    *   **Package Manager**: uv (Python 3.12+).
*   **Packages (`packages/*`)**:
    *   `editor-ext`: Shared Tiptap editor extensions.

---

## 2. Requirements & Setup

**Requirements:**
*   Node.js >= 22
*   PostgreSQL >= 16 (with pgvector extension)
*   Redis / Valkey >= 7
*   Python >= 3.12 (for Agent Gateway)
*   uv (Python package manager)

**Initialization:**
```bash
npm install -g pnpm
pnpm install
cp .env.example .env # Make sure to populate with local DB/Redis credentials
pnpm nx run @docmost/editor-ext:build # MUST be run first

# For Agent Gateway (optional, if using AI features)
cd apps/agent-gateway
cp config.example.yaml config.yaml
uv sync
```

---

## 3. Key Commands

### Main Application (from repository root)

| Action | Command |
| :--- | :--- |
| **Start Full Stack (Dev)** | `pnpm run dev` (Runs both client and server via Concurrently) |
| **Start Client (Dev)** | `pnpm run client:dev` |
| **Start Server (Dev)** | `pnpm run server:dev` |
| **Build Everything** | `pnpm build` |
| **Lint Client** | `pnpm --filter client run lint` |
| **Lint Server** | `pnpm --filter server run lint` |
| **Format Code** | `pnpm --filter <client|server> run format` |
| **Test Server** | `pnpm --filter server test` |

### Agent Gateway (from `apps/agent-gateway`)

| Action | Command |
| :--- | :--- |
| **Install Dependencies** | `make install` or `uv sync` |
| **Start LangGraph Server** | `make dev` (port 2024) |
| **Start Gateway API** | `make gateway` (port 8001) |
| **Lint** | `make lint` |
| **Format** | `make format` |
| **Test** | `uv run pytest` |

---

## 4. Database & Migrations (Critical)

Docmost uses **Kysely** for type-safe SQL queries. It strictly avoids heavy ORMs.

### Migration Commands
Migrations are located at `apps/server/src/database/migrations`.
*   **Run all pending**: `pnpm nx run server:migration:latest`
*   **Create new**: `pnpm nx run server:migration:create <migration_name>`
*   **Revert one**: `pnpm nx run server:migration:down`
*   **Reset all**: `pnpm nx run server:migration:reset`
*   **Generate Types (CRITICAL)**: `pnpm nx run server:migration:codegen`
    *   *AI Directive:* **Always** run the `codegen` command after altering the database schema or creating a new migration. This updates `apps/server/src/database/types/db.d.ts` which powers Kysely's type checking.

### Key Database Tables (AI-related)
*   `ai_sessions` - AI conversation sessions
*   `ai_messages` - AI messages with content and sources
*   `page_embeddings` - Vector embeddings for RAG

---

## 5. Backend Guidelines (`apps/server`)

*   **Architecture**: Follow standard NestJS modular architecture. Separate logic into Controllers, Services, and Repositories.
*   **Path Aliases**:
    *   Use `@docmost/db/*` to import from `apps/server/src/database/*`.
        *   Example: `import { dbOrTx } from '@docmost/db/utils';`
        *   Example: `import { InsertableWorkspace } from '@docmost/db/types/entity.types';`
*   **Repository Pattern**:
    *   All DB access must happen in `apps/server/src/database/repos/`.
    *   Never write queries in Services or Controllers.
    *   Inject the database using `@InjectKysely()` from `nestjs-kysely`.
    *   Use the exported types from Kysely schema generations (e.g., `Selectable<User>`, `Insertable<Workspace>`).
*   **Transactions**:
    *   Use the `dbOrTx` helper utility when a repository method might be executed within an existing transaction or a standalone query.
*   **Security**: Always validate user permissions (via Casl/Guards) and enforce `workspaceId` filtering on tenant-specific queries. Do not leak data across workspaces.
*   **Testing**: Write `.spec.ts` files using Jest next to the files they test (e.g., `page.service.ts` -> `page.service.spec.ts`).
*   **AI Module** (`apps/server/src/ai`):
    *   `AiOrchestratorService`: Routes requests to appropriate AI providers.
    *   `RagService`: Handles pgvector similarity search for context retrieval.
    *   `WebSearchService`: Performs web search via Serper API with query rewriting.
    *   `EmbeddingService`: Generates and manages vector embeddings.
    *   Providers: OpenAI-compatible interface supporting GLM, DeepSeek, MiniMax, Ollama.

---

## 6. Frontend Guidelines (`apps/client`)

*   **Path Aliases**:
    *   Use `@/*` to map to `apps/client/src/*`.
        *   Example: `import { Button } from '@/components/ui/button';`
*   **Styling**:
    *   Prefer Mantine (`@mantine/core`) components out of the box. Do not build custom UI primitives (buttons, modals, inputs) if Mantine provides them.
    *   Use standard Mantine props (`mt`, `mb`, `w`, `h`) or CSS modules for specific styling tweaks.
*   **Data Fetching**:
    *   Use `@tanstack/react-query` for API interactions.
    *   Do not store server state in Jotai. Use Jotai only for transient UI states (e.g., sidebar toggles, local preferences).
*   **Icons**:
    *   Use `@tabler/icons-react` for SVG icons.
*   **Editor**:
    *   Docmost heavily utilizes Tiptap. Any rich-text modifications should first consult the `editor-ext` workspace and existing `apps/client/src/features/editor` implementations.
*   **AI Feature** (`apps/client/src/features/ai`):
    *   `AiPage.tsx`: Main AI chat page layout.
    *   `use-ai-chat.ts`: Hook for regular AI chat (calls NestJS SSE).
    *   `use-design-chat.ts`: Hook for Web Design mode (calls LangGraph SSE).
    *   `use-langgraph-stream.ts`: Raw SSE streaming to LangGraph agent.
    *   `langgraph-client.ts`: LangGraph SDK client singleton.
    *   `ai.atoms.ts`: Jotai atoms for AI state management.
    *   See `doc/INTELLIGENCE_ARCHITECTURE.md` for detailed file mapping.

---

## 7. Agent Gateway Guidelines (`apps/agent-gateway`)

*   **Architecture**: LangGraph-based agent system with middleware chain, sandbox execution, and subagent delegation.
*   **Entry Point**: `langgraph.json` maps to `src.agents:make_lead_agent`.
*   **Lead Agent**: Single agent with dynamic model selection, tool system, and subagent support.
*   **Middleware Chain** (executes in order):
    1.  ThreadDataMiddleware - Per-thread isolated directories
    2.  UploadsMiddleware - Injects uploaded files into context
    3.  SandboxMiddleware - Acquires sandbox environment
    4.  SummarizationMiddleware - Reduces context at token limits
    5.  TodoListMiddleware - Tracks multi-step tasks
    6.  TitleMiddleware - Auto-generates conversation titles
    7.  MemoryMiddleware - Queues for memory extraction
    8.  ViewImageMiddleware - Injects image data for vision models
    9.  ClarificationMiddleware - Intercepts clarification requests
*   **Sandbox Tools**: `bash`, `ls`, `read_file`, `write_file`, `str_replace`.
*   **Configuration**: `config.yaml` for models, tools, sandbox; `extensions_config.json` for MCP servers and skills.
*   **Code Style**: ruff linter/formatter, 240 char line length, double quotes, 4-space indent.

---

## 8. AI Operating Mandates

When performing tasks in this repository, follow these rules:

1.  **Investigate First**: Always use `read`, `glob`, or `grep` to inspect the specific file structures, surrounding code, and Kysely DB types before making changes. **Never guess** the DB schema or UI props.
2.  **Strict Typing**: Ensure all TypeScript compiler checks pass. Do not use `any` unless absolutely necessary. Rely on Kysely's generated types for DB operations.
3.  **No Extraneous Dependencies**: Do not introduce new npm packages (especially UI libraries, or ORMs) without user consent. Leverage Mantine, NestJS, and Kysely.
4.  **Absolute Paths**: When using file system tools (e.g., `read`, `write`), ensure you construct full absolute paths by prepending the current working directory to the target file.
5.  **Self-Verification**: After editing code, run formatting (`pnpm format`), linting (`pnpm lint`), or TS compilation to verify your changes haven't broken the build. If modifying server logic, run the associated tests using `pnpm --filter server test`.
6.  **AI Feature Context**: For AI-related tasks, refer to `doc/INTELLIGENCE_ARCHITECTURE.md` for detailed file mappings and implementation flows.

---

## 9. Key Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Intelligence Architecture | `doc/INTELLIGENCE_ARCHITECTURE.md` | AI feature file map and flows |
| RAG Specification | `doc/INTELLIGENCE_RAG_SPEC.md` | RAG implementation details |
| Agent Gateway Docs | `apps/agent-gateway/docs/` | Configuration, API, architecture |
| Sidebar Style Overview | `doc/sidebar-style-overview.md` | UI styling reference |
