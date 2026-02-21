# Docmost AI Feature — Implementation TODO

> **Decision Record:** ZhipuAI (`openai-compatible`) is the chosen provider for both completions
> (`glm-4-flash`) and embeddings (`embedding-3` at 1024 dimensions). All new server code lives in
> `apps/server/src/ai/` (not `ee/`). All new client code lives in
> `apps/client/src/features/ai/` (not `ee/ai/`). Sessions and messages persist in PostgreSQL.
> Chat scope is **workspace-wide** RAG.

---

## Reality Check — What Already Exists (DO NOT RECREATE)

### Backend (already in place, wired and waiting)
| File | What it does |
|---|---|
| `integrations/queue/queue.module.ts` | `AI_QUEUE` (`{ai-queue}`) is already registered |
| `integrations/queue/constants/queue.constants.ts` | `QueueJob.GENERATE_PAGE_EMBEDDINGS`, `DELETE_PAGE_EMBEDDINGS`, `PAGE_CREATED`, `PAGE_CONTENT_UPDATED`, `WORKSPACE_CREATE_EMBEDDINGS`, `WORKSPACE_DELETE_EMBEDDINGS` already defined |
| `database/listeners/page.listener.ts` | Already enqueues `PAGE_CREATED`, `PAGE_DELETED`, `PAGE_SOFT_DELETED`, `PAGE_RESTORED` to `AI_QUEUE` — payload is always `{ pageIds: string[], workspaceId: string }` |
| `collaboration/extensions/persistence.extension.ts` | Already enqueues `PAGE_CONTENT_UPDATED` to `AI_QUEUE` on collab save |
| `core/workspace/services/workspace.service.ts` | Already triggers `WORKSPACE_CREATE_EMBEDDINGS` / `WORKSPACE_DELETE_EMBEDDINGS` |
| `integrations/environment/environment.service.ts` | `getAiDriver()`, `getOpenAiApiKey()`, `getOpenAiApiUrl()`, `getGeminiApiKey()`, `getOllamaApiUrl()`, `getAiEmbeddingModel()`, `getAiCompletionModel()`, `getAiEmbeddingDimension()` — all already exist |
| `integrations/environment/environment.validation.ts` | `AI_DRIVER`, `OPENAI_API_KEY`, `OPENAI_API_URL`, `GEMINI_API_KEY`, `OLLAMA_API_URL` — all validated already; no changes needed |
| `database/types/embeddings.types.ts` | `PageEmbeddings` Kysely interface already defined |
| `database/types/db.interface.ts` | `DbInterface` already extends `DB` with `pageEmbeddings` |
| `database/helpers/helpers.ts` | `isPageEmbeddingsTableExists()` already exists |
| `common/events/event.contants.ts` | All `EventName` values already defined |

### Frontend (already in `apps/client/src/ee/ai/` — will migrate to `features/ai/`)
| File | What it does |
|---|---|
| `ee/ai/types/ai.types.ts` | `AiAction` enum, `AiGenerateDto`, `AiStreamChunk`, `AiStreamError` |
| `ee/ai/services/ai-service.ts` | `generateAiContent()`, `generateAiContentStream()` via native fetch + ReadableStream |
| `ee/ai/services/ai-search-service.ts` | `aiAnswers()` SSE consumer hitting `/api/ai/answers` |
| `ee/ai/hooks/use-ai.ts` | `useAiStream()` — streaming state management |
| `ee/ai/hooks/use-ai-search.ts` | `useAiSearch()` — RAG search hook |
| `ee/ai/queries/ai-query.ts` | `useAiGenerateMutation()`, `useAiGenerateStreamMutation()` |
| `ee/ai/components/editor/ai-menu/ai-menu.tsx` | Full floating AI menu (325 lines), anchored to cursor |
| `ee/ai/components/editor/ai-menu/command-items.ts` | All command definitions (improve, summarize, translate, etc.) |
| `ee/ai/components/editor/ai-menu/result-preview.tsx` | Streaming markdown preview inside the menu |
| `ee/ai/components/ai-search-result.tsx` | Sources list + answer rendering (to be upgraded with citation renderer) |
| `features/editor/atoms/editor-atoms.ts` | `showAiMenuAtom` — toggles the floating AI menu |

### Key Integration Point — `asideStateAtom`
**File**: `apps/client/src/components/layouts/global/hooks/atoms/sidebar-atom.ts`
- Type: `atom<{ tab: string; isAsideOpen: boolean }>` — `tab` is a plain `string`, no union constraint
- Initial value: `{ tab: "", isAsideOpen: false }`
- There is **no** `toggleAside` helper function — set the atom directly
- To open AI panel: `setAsideState({ tab: 'ai', isAsideOpen: true })`
- To close: `setAsideState({ tab: '', isAsideOpen: false })`

---

## Environment Variables

### `.env` additions (ZhipuAI configuration)
```bash
# ---- AI Provider Config (ZhipuAI — OpenAI-compatible) ----
AI_DRIVER=openai-compatible
OPENAI_API_KEY=your-zhipu-api-key-here
OPENAI_API_URL=https://open.bigmodel.cn/api/paas/v4
AI_COMPLETION_MODEL=glm-4-flash
AI_EMBEDDING_MODEL=embedding-3
AI_EMBEDDING_DIMENSION=1024
```

> **Note:** `AI_EMBEDDING_DIMENSION=1024` is already a valid value in `environment.validation.ts`
> (`@IsIn(['768','1024','1536','2000','3072'])`). No validator change needed.

> **Other providers** (for reference, all env vars already validated):
> ```bash
> # OpenAI
> AI_DRIVER=openai
> OPENAI_API_KEY=sk-...
> AI_COMPLETION_MODEL=gpt-4o
> AI_EMBEDDING_MODEL=text-embedding-3-small
> AI_EMBEDDING_DIMENSION=1536
>
> # Gemini (completion only — use OpenAI for embeddings)
> AI_DRIVER=gemini
> GEMINI_API_KEY=...
> AI_COMPLETION_MODEL=gemini-1.5-flash
>
> # Ollama (local)
> AI_DRIVER=ollama
> OLLAMA_API_URL=http://localhost:11434
> AI_COMPLETION_MODEL=llama3
> ```

---

## Infrastructure Fix — Docker Compose (BLOCKER)

**Issue:** `docker-compose.yml` uses `postgres:18` which does NOT include the pgvector extension.
The migration `CREATE EXTENSION IF NOT EXISTS vector` will fail with:
`ERROR: could not open extension control file`.

**Fix:** Change the postgres service image in `docker-compose.yml`:
```yaml
# Before:
image: postgres:18

# After:
image: pgvector/pgvector:pg18
```

> **Note:** The `pgvector/pgvector` image is the official pgvector-enabled build. It publishes tags
> for every major Postgres version. Use `pg18` to match the existing postgres major version.
> Anyone running the Docker stack must rebuild their container after this change.
>
> For local non-Docker installs: run `CREATE EXTENSION IF NOT EXISTS vector` manually once, or
> install pgvector via your package manager (e.g. `brew install pgvector` on macOS).

---

## Database Migrations

### Migration 1: `page_embeddings` table + pgvector
**File:** `apps/server/src/database/migrations/[timestamp]_page_embeddings.ts`

```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Enable pgvector extension (idempotent)
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('page_embeddings')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull())
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull())
    .addColumn('model_name', 'varchar', (col) => col.notNull())
    .addColumn('model_dimensions', 'integer', (col) => col.notNull())
    .addColumn('attachment_id', 'varchar', (col) =>
      col.notNull().defaultTo(''))
    // vector(1024) matches AI_EMBEDDING_DIMENSION=1024 (ZhipuAI embedding-3).
    // If you switch providers with a different dimension, write a new migration:
    //   ALTER TABLE page_embeddings ALTER COLUMN embedding TYPE vector(N)
    //   and clear all existing embeddings (they are incompatible).
    .addColumn('embedding', sql`vector(1024)`, (col) => col.notNull())
    .addColumn('chunk_index', 'integer', (col) =>
      col.notNull().defaultTo(0))
    .addColumn('chunk_start', 'integer', (col) =>
      col.notNull().defaultTo(0))
    .addColumn('chunk_length', 'integer', (col) =>
      col.notNull().defaultTo(0))
    .addColumn('metadata', 'jsonb', (col) =>
      col.notNull().defaultTo('{}'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  // HNSW index — best for ANN cosine similarity at query time
  await sql`
    CREATE INDEX page_embeddings_embedding_idx
    ON page_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `.execute(db);

  // Standard B-tree indexes for filtering
  await db.schema
    .createIndex('page_embeddings_workspace_id_idx')
    .on('page_embeddings')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('page_embeddings_page_id_idx')
    .on('page_embeddings')
    .column('page_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('page_embeddings').execute();
  // Note: do NOT drop the vector extension — other tables may use it
}
```

> **Provider switch warning:** `vector(1024)` is hardcoded because `ADD COLUMN` requires a fixed
> type at DDL time. If `AI_EMBEDDING_DIMENSION` is changed to a different value in `.env`, existing
> embeddings in the table will be incompatible with new inserts. When switching providers:
> 1. Run `TRUNCATE page_embeddings` to clear stale embeddings
> 2. Write a new migration: `ALTER TABLE page_embeddings ALTER COLUMN embedding TYPE vector(N)`
> 3. Re-trigger `WORKSPACE_CREATE_EMBEDDINGS` to rebuild all embeddings

**After running migration:** Run `pnpm nx run server:migration:codegen` to regenerate types.
> **IMPORTANT:** The `pageEmbeddings` entry in `db.interface.ts` must remain — codegen does NOT
> add it automatically because `vector` is not a standard Kysely type. After codegen, verify
> `db.interface.ts` still has `pageEmbeddings: PageEmbeddings`.

### Migration 2: `ai_sessions` table
**File:** `apps/server/src/database/migrations/[timestamp]_ai_sessions.ts`

```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ai_sessions')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull())
    // page_id is nullable — session can be workspace-scoped (no specific page)
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'))
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull())
    .addColumn('title', 'varchar')           // first user message truncated to 80 chars
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('ai_sessions_workspace_user_idx')
    .on('ai_sessions')
    .columns(['workspace_id', 'user_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ai_sessions').execute();
}
```

### Migration 3: `ai_messages` table
**File:** `apps/server/src/database/migrations/[timestamp]_ai_messages.ts`

```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('ai_messages')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`))
    .addColumn('session_id', 'uuid', (col) =>
      col.references('ai_sessions.id').onDelete('cascade').notNull())
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull())
    .addColumn('role', 'varchar', (col) => col.notNull())   // 'user' | 'assistant'
    .addColumn('content', 'text', (col) => col.notNull())
    // sources: JSONB — stores citation metadata alongside each assistant message.
    // Shape: Array<{ pageId, title, slugId, spaceSlug, excerpt, similarity }>
    // Self-contained history — no joins needed to render citations from old messages.
    .addColumn('sources', 'jsonb', (col) => col.defaultTo('[]'))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('ai_messages_session_id_idx')
    .on('ai_messages')
    .column('session_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('ai_messages').execute();
}
```

> After all three migrations: run `pnpm nx run server:migration:latest` then
> `pnpm nx run server:migration:codegen`.

---

## Backend Implementation

### File Map: `apps/server/src/ai/`

```
apps/server/src/ai/
├── ai.module.ts
├── ai.controller.ts
│
├── interfaces/
│   └── ai-provider.interface.ts
│
├── providers/
│   ├── openai.provider.ts       # 'openai' + 'openai-compatible' (ZhipuAI)
│   ├── gemini.provider.ts       # 'gemini'
│   └── ollama.provider.ts       # 'ollama'
│
├── services/
│   ├── ai-orchestrator.service.ts
│   ├── embedding.service.ts
│   └── rag.service.ts
│
├── processors/
│   └── ai-queue.processor.ts
│
├── repos/
│   ├── page-embedding.repo.ts
│   ├── ai-session.repo.ts       # Step 12
│   └── ai-message.repo.ts       # Step 12
│
└── dto/
    ├── ai-generate.dto.ts
    ├── ai-chat.dto.ts
    └── ai-session.dto.ts        # Step 12
```

---

### `interfaces/ai-provider.interface.ts`

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RagChunk {
  pageId: string;
  title: string;
  slugId: string;
  spaceSlug: string;
  excerpt: string;         // the actual text chunk used as context
  similarity: number;
  chunkIndex: number;
}

export interface AiProvider {
  /**
   * Non-streaming: generate text for editor actions (improve, summarize, etc.)
   * Used by POST /ai/generate
   */
  generateText(
    systemPrompt: string,
    content: string,
  ): Promise<string>;

  /**
   * Streaming: generate text for editor actions with SSE chunks
   * Used by POST /ai/generate/stream
   */
  streamText(
    systemPrompt: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * Streaming: RAG chat — takes history + retrieved chunks, streams answer
   * Used by POST /ai/chat/stream (the new citation-enabled endpoint)
   */
  streamChat(
    messages: ChatMessage[],
    ragContext: RagChunk[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * Generate vector embeddings for a list of text strings
   * Called by EmbeddingService when processing page chunks
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
```

---

### `providers/openai.provider.ts`

```typescript
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AiProvider, ChatMessage, RagChunk } from '../interfaces/ai-provider.interface';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { buildRagSystemPrompt, buildEditorSystemPrompt } from '../utils/prompt.utils';

@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly embeddingModel: string;

  constructor(private readonly env: EnvironmentService) {
    const isCompatible = env.getAiDriver() === 'openai-compatible';
    this.client = new OpenAI({
      apiKey: env.getOpenAiApiKey(),
      baseURL: isCompatible ? env.getOpenAiApiUrl() : undefined,
      // undefined → falls back to OpenAI default https://api.openai.com/v1
    });
    this.model = env.getAiCompletionModel();           // e.g. 'glm-4-flash'
    this.embeddingModel = env.getAiEmbeddingModel();   // e.g. 'embedding-3'
  }

  async generateText(systemPrompt: string, content: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      stream: false,
    });
    return response.choices[0].message.content ?? '';
  }

  async streamText(
    systemPrompt: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      stream: true,
    }, { signal });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) onChunk(text);
    }
    onComplete();
  }

  async streamChat(
    messages: ChatMessage[],
    ragContext: RagChunk[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const systemPrompt = buildRagSystemPrompt(ragContext);
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }, { signal });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) onChunk(text);
    }
    onComplete();
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,     // 'embedding-3' for ZhipuAI
      input: texts,
    });
    // OpenAI SDK returns embeddings sorted by index
    return response.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }
}
```

---

### `providers/gemini.provider.ts`

```typescript
// Uses @ai-sdk/google
// Install: pnpm --filter server add @ai-sdk/google ai
import { Injectable, NotImplementedException } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText as aiGenerateText, streamText as aiStreamText } from 'ai';
import { AiProvider, ChatMessage, RagChunk } from '../interfaces/ai-provider.interface';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { buildRagSystemPrompt, buildEditorSystemPrompt } from '../utils/prompt.utils';

@Injectable()
export class GeminiProvider implements AiProvider {
  private readonly google;
  private readonly model: string;

  constructor(private readonly env: EnvironmentService) {
    this.google = createGoogleGenerativeAI({ apiKey: env.getGeminiApiKey() });
    this.model = env.getAiCompletionModel(); // e.g. 'gemini-1.5-flash'
  }

  async generateText(systemPrompt: string, content: string): Promise<string> {
    const { text } = await aiGenerateText({
      model: this.google(this.model),
      system: systemPrompt,
      prompt: content,
    });
    return text;
  }

  async streamText(
    systemPrompt: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const { fullStream } = await aiStreamText({
      model: this.google(this.model),
      system: systemPrompt,
      prompt: content,
      abortSignal: signal,
    });
    for await (const delta of fullStream) {
      if (delta.type === 'text-delta') onChunk(delta.textDelta);
    }
    onComplete();
  }

  async streamChat(
    messages: ChatMessage[],
    ragContext: RagChunk[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const systemPrompt = buildRagSystemPrompt(ragContext);
    const { fullStream } = await aiStreamText({
      model: this.google(this.model),
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      abortSignal: signal,
    });
    for await (const delta of fullStream) {
      if (delta.type === 'text-delta') onChunk(delta.textDelta);
    }
    onComplete();
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Gemini embedding API uses a different SDK path — not yet implemented.
    throw new NotImplementedException(
      'Gemini embedding support not yet implemented. ' +
      'Use AI_DRIVER=openai-compatible for embeddings.'
    );
  }
}
```

---

### `providers/ollama.provider.ts`

```typescript
// Ollama text completions are OpenAI-compatible (/v1/chat/completions).
// Ollama embeddings use a separate /api/embeddings endpoint (not OpenAI-compatible).
import { Injectable, NotImplementedException } from '@nestjs/common';
import OpenAI from 'openai';
import { AiProvider, ChatMessage, RagChunk } from '../interfaces/ai-provider.interface';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { buildRagSystemPrompt, buildEditorSystemPrompt } from '../utils/prompt.utils';

@Injectable()
export class OllamaProvider implements AiProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly env: EnvironmentService) {
    this.client = new OpenAI({
      apiKey: 'ollama',  // Ollama doesn't require a real key
      baseURL: `${env.getOllamaApiUrl()}/v1`,
    });
    this.model = env.getAiCompletionModel();
  }

  async generateText(systemPrompt: string, content: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      stream: false,
    });
    return response.choices[0].message.content ?? '';
  }

  async streamText(
    systemPrompt: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      stream: true,
    }, { signal });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) onChunk(text);
    }
    onComplete();
  }

  async streamChat(
    messages: ChatMessage[],
    ragContext: RagChunk[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const systemPrompt = buildRagSystemPrompt(ragContext);
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    }, { signal });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) onChunk(text);
    }
    onComplete();
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Ollama /api/embeddings is NOT OpenAI-compatible — call raw API
    const results: number[][] = [];
    for (const text of texts) {
      const response = await fetch(`${this.client.baseURL.replace('/v1', '')}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.env.getAiEmbeddingModel(), prompt: text }),
      });
      if (!response.ok) {
        throw new Error(`Ollama embeddings API error: ${response.status}`);
      }
      const data = await response.json();
      results.push(data.embedding);
    }
    return results;
  }
}
```

> **Note:** `OllamaProvider` now has full implementations (not stubs) for all methods.
> `generateEmbeddings` calls the Ollama-native `/api/embeddings` endpoint directly.
> `streamText` and `streamChat` use the OpenAI-compatible `/v1/chat/completions` endpoint.

---

### `utils/prompt.utils.ts`

```typescript
import { RagChunk } from '../interfaces/ai-provider.interface';
import { AiAction } from './ai-action.enum';

/**
 * Builds the system prompt for RAG chat.
 * Sources are numbered — the model is instructed to cite using [^n] notation.
 * The frontend AiCitationRenderer maps [^n] back to source metadata.
 */
export function buildRagSystemPrompt(chunks: RagChunk[]): string {
  const sourceBlocks = chunks
    .map((c, i) =>
      `[^${i + 1}] (Page: "${c.title}", path: /docs/${c.slugId}):\n"${c.excerpt}"`
    )
    .join('\n\n');

  return `You are a helpful assistant with access to the workspace knowledge base.
Use the following document excerpts as your primary sources.
Cite them inline using [^1], [^2] notation. Only cite when directly relevant.
If the sources do not contain the answer, say so clearly.

${sourceBlocks}`;
}

/**
 * Builds the system prompt for editor-action generation (improve, summarize, etc.)
 */
export function buildEditorSystemPrompt(action: AiAction, extraPrompt?: string): string {
  const prompts: Record<AiAction, string> = {
    [AiAction.IMPROVE_WRITING]: 'Improve the writing of the following text. Return only the improved text without explanations.',
    [AiAction.FIX_SPELLING_GRAMMAR]: 'Fix all spelling and grammar errors in the following text. Return only the corrected text.',
    [AiAction.MAKE_SHORTER]: 'Make the following text shorter while preserving the key meaning. Return only the shortened text.',
    [AiAction.MAKE_LONGER]: 'Expand the following text with more detail. Return only the expanded text.',
    [AiAction.SIMPLIFY]: 'Simplify the following text so it is easy to understand. Return only the simplified text.',
    [AiAction.CHANGE_TONE]: `Rewrite the following text in a ${extraPrompt ?? 'professional'} tone. Return only the rewritten text.`,
    [AiAction.SUMMARIZE]: 'Summarize the following text in a concise paragraph. Return only the summary.',
    [AiAction.EXPLAIN]: 'Explain the following text in simple terms. Return only the explanation.',
    [AiAction.CONTINUE_WRITING]: 'Continue writing from where the following text ends. Return only the continuation.',
    [AiAction.TRANSLATE]: `Translate the following text to ${extraPrompt ?? 'English'}. Return only the translation.`,
    [AiAction.CUSTOM]: extraPrompt ?? 'Process the following text as requested.',
  };
  return prompts[action] ?? prompts[AiAction.CUSTOM];
}
```

---

### `services/embedding.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { PageEmbeddingRepo } from '../repos/page-embedding.repo';
import { isPageEmbeddingsTableExists } from '@docmost/db/helpers';

/**
 * Responsible for chunking page text and generating embeddings.
 * Called by AiQueueProcessor — never called directly by controllers.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  // Cache the table-exists check after first positive result to avoid
  // redundant DB round-trips on every job (see isPageEmbeddingsTableExists note below).
  private tableExistsCache = false;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly orchestrator: AiOrchestratorService,
    private readonly embeddingRepo: PageEmbeddingRepo,
  ) {}

  private async isTableReady(): Promise<boolean> {
    if (this.tableExistsCache) return true;
    const exists = await isPageEmbeddingsTableExists(this.db);
    if (exists) this.tableExistsCache = true;
    return exists;
  }

  async embedPage(pageId: string, workspaceId: string): Promise<void> {
    if (!(await this.isTableReady())) return;

    // Fetch page text content
    const page = await this.db
      .selectFrom('pages')
      .select(['id', 'title', 'textContent', 'spaceId'])
      .where('id', '=', pageId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!page || !page.textContent) {
      this.logger.debug(`Page ${pageId} has no text content, skipping embedding`);
      return;
    }

    // Chunk the text (simple fixed-size chunking for Phase 1)
    const chunks = chunkText(page.textContent, 512, 64); // size=512, overlap=64

    // Delete existing embeddings for this page (re-embed on update)
    await this.embeddingRepo.deleteByPageId(pageId);

    // Generate embeddings in batches of 20 (ZhipuAI rate limit friendly)
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await this.orchestrator
        .getProvider()
        .generateEmbeddings(batch.map(c => c.text));

      await this.embeddingRepo.insertMany(
        batch.map((chunk, idx) => ({
          pageId,
          spaceId: page.spaceId,
          workspaceId,
          modelName: process.env.AI_EMBEDDING_MODEL ?? '',
          modelDimensions: embeddings[0].length,
          embedding: embeddings[idx],
          chunkIndex: i + idx,
          chunkStart: chunk.start,
          chunkLength: chunk.length,
          // Store both title AND excerpt in metadata.
          // excerpt is required by RagService.retrieve() which reads metadata->>'excerpt'.
          metadata: {
            title: page.title,
            excerpt: chunk.text.slice(0, 200),
          },
        })),
      );
    }

    this.logger.debug(`Embedded page ${pageId}: ${chunks.length} chunks`);
  }

  async embedWorkspace(workspaceId: string): Promise<void> {
    const pages = await this.db
      .selectFrom('pages')
      .select(['id'])
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();

    for (const page of pages) {
      await this.embedPage(page.id, workspaceId);
    }
  }
}

/**
 * Simple fixed-size chunking with word-boundary awareness.
 * Phase 1: character-based chunks. Phase 2: token-aware using tiktoken.
 *
 * Safety: overlap must be strictly less than chunkSize to avoid infinite loops.
 * The hardcoded call chunkText(text, 512, 64) satisfies this (64 < 512).
 * If making these configurable, add a guard: overlap = Math.min(overlap, chunkSize - 1).
 */
function chunkText(
  text: string,
  chunkSize = 512,
  overlap = 64,
): Array<{ text: string; start: number; length: number }> {
  // Guard: ensure we always make forward progress
  const safeOverlap = Math.min(overlap, chunkSize - 1);
  const chunks: Array<{ text: string; start: number; length: number }> = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    // Extend to next word boundary to avoid mid-word splits
    const spaceIdx = text.indexOf(' ', end);
    const wordEnd = spaceIdx === -1 ? end : spaceIdx;
    const chunk = text.slice(start, wordEnd);
    chunks.push({ text: chunk, start, length: chunk.length });
    start += chunkSize - safeOverlap;
  }

  return chunks;
}
```

---

### `services/rag.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { RagChunk } from '../interfaces/ai-provider.interface';
import { isPageEmbeddingsTableExists } from '@docmost/db/helpers';

@Injectable()
export class RagService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly orchestrator: AiOrchestratorService,
  ) {}

  /**
   * Retrieves the top-K most semantically similar page chunks for a query.
   * Scoped to workspaceId (workspace-wide search).
   * Returns empty array if pgvector table does not exist.
   */
  async retrieve(
    query: string,
    workspaceId: string,
    topK = 5,
  ): Promise<RagChunk[]> {
    if (!(await isPageEmbeddingsTableExists(this.db))) return [];

    const [queryEmbedding] = await this.orchestrator
      .getProvider()
      .generateEmbeddings([query]);

    // pgvector cosine similarity: 1 - (a <=> b)
    // Cast the JS array to a pgvector literal
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const rows = await sql<{
      pageId: string;
      title: string;
      slugId: string;
      spaceSlug: string;
      excerpt: string;
      similarity: number;
      chunkIndex: number;
    }>`
      SELECT
        pe.page_id       AS "pageId",
        p.title,
        p.slug_id        AS "slugId",
        s.slug           AS "spaceSlug",
        (pe.metadata->>'excerpt')::text AS excerpt,
        1 - (pe.embedding <=> ${sql.raw(`'${vectorLiteral}'::vector`)}::vector) AS similarity,
        pe.chunk_index   AS "chunkIndex"
      FROM page_embeddings pe
      INNER JOIN pages p  ON p.id = pe.page_id
      INNER JOIN spaces s ON s.id = pe.space_id
      WHERE pe.workspace_id = ${workspaceId}
        AND p.deleted_at IS NULL
      ORDER BY similarity DESC
      LIMIT ${topK}
    `.execute(this.db);

    return rows.rows;
  }
}
```

> **Note:** `excerpt` is read from `metadata->>'excerpt'`. `EmbeddingService` stores it as
> `metadata: { title, excerpt: chunk.text.slice(0, 200) }`. Both sides must match — do not
> change one without updating the other.

---

### `services/ai-orchestrator.service.ts`

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { AiProvider } from '../interfaces/ai-provider.interface';
import { OpenAiProvider } from '../providers/openai.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { OllamaProvider } from '../providers/ollama.provider';

@Injectable()
export class AiOrchestratorService {
  constructor(
    private readonly env: EnvironmentService,
    private readonly openAiProvider: OpenAiProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly ollamaProvider: OllamaProvider,
  ) {}

  getProvider(): AiProvider {
    const driver = this.env.getAiDriver();
    switch (driver) {
      case 'openai':
      case 'openai-compatible':   // ZhipuAI, DeepSeek, Groq, etc.
        return this.openAiProvider;
      case 'gemini':
        return this.geminiProvider;
      case 'ollama':
        return this.ollamaProvider;
      default:
        throw new Error(
          `Unknown AI driver: "${driver}". ` +
          `Set AI_DRIVER to one of: openai, openai-compatible, gemini, ollama`
        );
    }
  }

  /**
   * Returns true if AI_DRIVER is set to a non-empty, recognised value.
   * Used by controllers to return a clean 503 instead of a generic 500
   * when AI is not configured.
   */
  isConfigured(): boolean {
    const driver = this.env.getAiDriver();
    return ['openai', 'openai-compatible', 'gemini', 'ollama'].includes(driver ?? '');
  }
}
```

---

### `processors/ai-queue.processor.ts`

```typescript
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { EmbeddingService } from '../services/embedding.service';
import { PageEmbeddingRepo } from '../repos/page-embedding.repo';
import { isPageEmbeddingsTableExists } from '@docmost/db/helpers';
import { AiOrchestratorService } from '../services/ai-orchestrator.service';

@Processor(QueueName.AI_QUEUE)
@Injectable()
export class AiQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(AiQueueProcessor.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly embeddingService: EmbeddingService,
    private readonly embeddingRepo: PageEmbeddingRepo,
    private readonly orchestrator: AiOrchestratorService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // Guard: if AI is not configured or pgvector table absent, skip silently
    if (!this.orchestrator.isConfigured()) return;
    if (!(await isPageEmbeddingsTableExists(this.db))) return;

    switch (job.name) {
      // Page lifecycle — triggered by PageListener (already wired).
      // Payload: { pageIds: string[], workspaceId: string }
      case QueueJob.PAGE_CREATED:
      case QueueJob.PAGE_RESTORED: {
        const { pageIds, workspaceId } = job.data;
        for (const pageId of pageIds) {
          await this.embeddingService.embedPage(pageId, workspaceId);
        }
        break;
      }

      // Content update — triggered by collab persistence layer (already wired).
      // Payload: { pageId: string, workspaceId: string }
      case QueueJob.PAGE_CONTENT_UPDATED: {
        const { pageId, workspaceId } = job.data;
        await this.embeddingService.embedPage(pageId, workspaceId);
        break;
      }

      // Soft delete / hard delete.
      // Payload: { pageIds: string[], workspaceId: string }
      // Both PAGE_SOFT_DELETED and PAGE_DELETED use pageIds (plural array) —
      // verified against page.listener.ts which always sends { pageIds: string[] }.
      case QueueJob.PAGE_SOFT_DELETED:
      case QueueJob.PAGE_DELETED: {
        const { pageIds } = job.data;
        await this.embeddingRepo.deleteByPageIds(pageIds);
        break;
      }

      // Per-page explicit embed/delete
      case QueueJob.GENERATE_PAGE_EMBEDDINGS: {
        const { pageId, workspaceId } = job.data;
        await this.embeddingService.embedPage(pageId, workspaceId);
        break;
      }

      case QueueJob.DELETE_PAGE_EMBEDDINGS: {
        const { pageIds } = job.data;
        await this.embeddingRepo.deleteByPageIds(pageIds);
        break;
      }

      // Workspace-level bulk operations
      case QueueJob.WORKSPACE_CREATE_EMBEDDINGS: {
        const { workspaceId } = job.data;
        await this.embeddingService.embedWorkspace(workspaceId);
        break;
      }

      case QueueJob.WORKSPACE_DELETE_EMBEDDINGS: {
        const { workspaceId } = job.data;
        await this.embeddingRepo.deleteByWorkspaceId(workspaceId);
        break;
      }

      default:
        this.logger.warn(`Unknown AI queue job: ${job.name}`);
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.debug(`Processing AI job: ${job.name} [${job.id}]`);
  }

  @OnWorkerEvent('failed')
  onError(job: Job, error: Error) {
    this.logger.error(`AI job failed: ${job.name} [${job.id}] — ${error.message}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`AI job completed: ${job.name} [${job.id}]`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
```

---

### `repos/page-embedding.repo.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { DbInterface } from '@docmost/db/types/db.interface';
import { sql } from 'kysely';

@Injectable()
export class PageEmbeddingRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async insertMany(
    embeddings: Array<{
      pageId: string;
      spaceId: string;
      workspaceId: string;
      modelName: string;
      modelDimensions: number;
      embedding: number[];
      chunkIndex: number;
      chunkStart: number;
      chunkLength: number;
      metadata: Record<string, any>;
    }>,
  ): Promise<void> {
    if (embeddings.length === 0) return;

    // pgvector requires the embedding as a string literal '[x,y,z,...]'
    const rows = embeddings.map((e) => ({
      pageId: e.pageId,
      spaceId: e.spaceId,
      workspaceId: e.workspaceId,
      modelName: e.modelName,
      modelDimensions: e.modelDimensions,
      attachmentId: '',
      // Cast to vector type using sql template
      embedding: sql`${`[${e.embedding.join(',')}]`}::vector`,
      chunkIndex: e.chunkIndex,
      chunkStart: e.chunkStart,
      chunkLength: e.chunkLength,
      metadata: JSON.stringify(e.metadata),
    }));

    await (this.db as unknown as DbInterface)
      .insertInto('pageEmbeddings')
      .values(rows as any)
      .execute();
  }

  async deleteByPageId(pageId: string): Promise<void> {
    await (this.db as unknown as DbInterface)
      .deleteFrom('pageEmbeddings')
      .where('pageId', '=', pageId)
      .execute();
  }

  async deleteByPageIds(pageIds: string[]): Promise<void> {
    if (pageIds.length === 0) return;
    await (this.db as unknown as DbInterface)
      .deleteFrom('pageEmbeddings')
      .where('pageId', 'in', pageIds)
      .execute();
  }

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    await (this.db as unknown as DbInterface)
      .deleteFrom('pageEmbeddings')
      .where('workspaceId', '=', workspaceId)
      .execute();
  }
}
```

---

### `ai.controller.ts`

> **Critical Fastify SSE pattern:** Fastify intercepts `@Res()` responses. For SSE (streaming),
> you MUST call `reply.hijack()` BEFORE writing to `res.raw`. Without `hijack()`, Fastify will
> attempt to finalize the response after the async handler resolves, corrupting the stream or
> triggering double-send errors. This pattern is confirmed by Docmost's own v0.24.1 hotfix
> "Fix AI streaming bug". Every SSE endpoint below starts with `reply.hijack()`.

```typescript
import {
  Controller, Post, Get, Body, Req, Res, UseGuards,
  Delete, Param, HttpCode,
} from '@nestjs/common';
import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { RagService } from './services/rag.service';
import { AiGenerateDto } from './dto/ai-generate.dto';
import { AiChatDto } from './dto/ai-chat.dto';
import { buildEditorSystemPrompt } from './utils/prompt.utils';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly ragService: RagService,
  ) {}

  // ── Configuration guard helper ────────────────────────────────────────────

  private ensureConfigured(): void {
    if (!this.orchestrator.isConfigured()) {
      throw new ServiceUnavailableException(
        'AI is not configured. Set AI_DRIVER and related environment variables.'
      );
    }
  }

  // ── AI status endpoint (frontend gating) ─────────────────────────────────

  /**
   * Returns whether AI is configured and available.
   * The frontend uses this to decide whether to show the AI sparkles button.
   * No auth required — safe to call before session is established.
   */
  @Get('status')
  @HttpCode(200)
  getStatus() {
    return { configured: this.orchestrator.isConfigured() };
  }

  // ── Editor actions ───────────────────────────────────────────────────────

  /** Non-streaming: used by the editor AI menu for quick actions */
  @Post('generate')
  async generate(@Body() dto: AiGenerateDto, @AuthUser() user: any) {
    this.ensureConfigured();
    const systemPrompt = buildEditorSystemPrompt(dto.action, dto.prompt);
    const content = await this.orchestrator.getProvider().generateText(
      systemPrompt,
      dto.content,
    );
    return { content };
  }

  /** Streaming: used by the editor AI menu for live preview */
  @Post('generate/stream')
  async streamGenerate(
    @Body() dto: AiGenerateDto,
    @Req() req: any,
    @Res() reply: any,
    @AuthUser() user: any,
  ) {
    this.ensureConfigured();

    // MUST call hijack() first — prevents Fastify from sending its own response
    // after this async handler resolves and corrupting the stream.
    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemPrompt = buildEditorSystemPrompt(dto.action, dto.prompt);

    try {
      await this.orchestrator.getProvider().streamText(
        systemPrompt,
        dto.content,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
        () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
        req.raw.signal,
      );
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  // ── RAG chat (citation-enabled) ──────────────────────────────────────────

  /**
   * Streaming RAG chat endpoint.
   * Flow:
   *   1. Retrieve top-K relevant chunks (pgvector similarity search)
   *   2. Emit sources event immediately so the frontend can render citations
   *   3. Stream the LLM answer with [^n] citation markers
   */
  @Post('chat/stream')
  async streamChat(
    @Body() dto: AiChatDto,
    @Req() req: any,
    @Res() reply: any,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ) {
    this.ensureConfigured();

    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // Step 1: retrieve relevant chunks from pgvector
      const lastMessage = dto.messages[dto.messages.length - 1];
      const chunks = await this.ragService.retrieve(
        lastMessage.content,
        workspace.id,
      );

      // Step 2: emit sources immediately — frontend renders citation popovers before answer
      res.write(
        `data: ${JSON.stringify({ type: 'sources', data: chunks })}\n\n`,
      );

      // Step 3: stream the LLM answer
      await this.orchestrator.getProvider().streamChat(
        dto.messages,
        chunks,
        (chunk) => {
          res.write(
            `data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`,
          );
        },
        () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
        req.raw.signal,
      );
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      res.end();
    }
  }

  // ── Legacy compatibility endpoint (used by existing ee/ai/services) ─────

  /**
   * Existing frontend calls /api/ai/answers — keep this endpoint working.
   * Internally delegates to streamChat logic.
   */
  @Post('answers')
  async streamAnswers(
    @Body() dto: { query: string },
    @Req() req: any,
    @Res() reply: any,
    @AuthUser() user: any,
    @AuthWorkspace() workspace: any,
  ) {
    this.ensureConfigured();

    reply.hijack();

    const res = reply.raw;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();

    try {
      const chunks = await this.ragService.retrieve(dto.query, workspace.id);
      res.write(`data: ${JSON.stringify({ sources: chunks })}\n\n`);

      await this.orchestrator.getProvider().streamChat(
        [{ role: 'user', content: dto.query }],
        chunks,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
        () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
        req.raw.signal,
      );
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }

  // ── Session CRUD (Step 12 — deferred) ────────────────────────────────────
  // These endpoints are intentionally omitted until Step 12.
  // Leaving empty stubs here would cause DI bootstrap failures.
  // AiSessionRepo and AiMessageRepo are added to the module in Step 12.
}
```

---

### `ai.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiController } from './ai.controller';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { EmbeddingService } from './services/embedding.service';
import { RagService } from './services/rag.service';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AiQueueProcessor } from './processors/ai-queue.processor';
import { PageEmbeddingRepo } from './repos/page-embedding.repo';
import { QueueName } from '../integrations/queue/constants';

@Module({
  imports: [
    // AiQueueProcessor is decorated with @Processor(QueueName.AI_QUEUE).
    // BullMQ requires the queue to be registered in the same module context as
    // the processor — this import makes AiModule self-contained.
    // The global QueueModule also registers AI_QUEUE, but that is not sufficient
    // for the processor's DI context.
    BullModule.registerQueue({ name: QueueName.AI_QUEUE }),
  ],
  controllers: [AiController],
  providers: [
    // Orchestrator + providers
    AiOrchestratorService,
    OpenAiProvider,
    GeminiProvider,
    OllamaProvider,
    // Services
    EmbeddingService,
    RagService,
    // Repos
    PageEmbeddingRepo,
    // Queue processor — registers itself with BullMQ.AI_QUEUE
    AiQueueProcessor,
  ],
  exports: [AiOrchestratorService, EmbeddingService, RagService],
})
export class AiModule {}
```

**Register in `app.module.ts`:**
```typescript
import { AiModule } from './ai/ai.module';
// ...
imports: [
  // ... existing imports ...
  AiModule,
]
```

---

### DTOs

**`dto/ai-generate.dto.ts`**
```typescript
import { IsEnum, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { AiAction } from '../utils/ai-action.enum';

export class AiGenerateDto {
  @IsOptional()
  @IsEnum(AiAction)
  action?: AiAction;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}
```

**`dto/ai-chat.dto.ts`**
```typescript
import { IsArray, IsString, IsIn, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class AiChatDto {
  @IsArray()
  @ArrayMinSize(1)   // Prevents dto.messages[dto.messages.length - 1] from being undefined
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  // Optional: scope to specific space
  // spaceId?: string;
}
```

**`dto/ai-session.dto.ts`** *(Step 12 — define before implementing session endpoints)*
```typescript
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAiSessionDto {
  @IsOptional()
  @IsUUID()
  pageId?: string;
}

export class AiSessionResponseDto {
  id: string;
  workspaceId: string;
  pageId: string | null;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AiMessageResponseDto {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  sources: any[];
  createdAt: string;
}
```

---

### `utils/ai-action.enum.ts`

```typescript
// Mirrors the frontend AiAction enum in ee/ai/types/ai.types.ts
// Single source of truth on the backend
export enum AiAction {
  IMPROVE_WRITING      = 'improve_writing',
  FIX_SPELLING_GRAMMAR = 'fix_spelling_grammar',
  MAKE_SHORTER         = 'make_shorter',
  MAKE_LONGER          = 'make_longer',
  SIMPLIFY             = 'simplify',
  CHANGE_TONE          = 'change_tone',
  SUMMARIZE            = 'summarize',
  EXPLAIN              = 'explain',
  CONTINUE_WRITING     = 'continue_writing',
  TRANSLATE            = 'translate',
  CUSTOM               = 'custom',
}
```

---

### Session Repos (Step 12)

**`repos/ai-session.repo.ts`** and **`repos/ai-message.repo.ts`** — follow the exact same Kysely
pattern as `PageEmbeddingRepo` above, using `@InjectKysely()` and the generated types after
migrations are run and `codegen` is executed.

When these repos are added (Step 12), also add them to `AiModule.providers` and inject them
into the session CRUD endpoints in `AiController`.

---

## Frontend Implementation

### File Map: `apps/client/src/features/ai/`

```
apps/client/src/features/ai/
├── components/
│   ├── AiSidebar.tsx              # Main chat panel — toggled via asideStateAtom
│   ├── AiMessageList.tsx          # Renders persisted + streaming messages
│   ├── AiMessageInput.tsx         # Mantine Textarea + submit button
│   ├── AiCitationRenderer.tsx     # [^n] → Mantine Popover citation component
│   └── ai-sidebar.module.css
│
├── hooks/
│   ├── use-ai-chat.ts             # Manages the chat SSE stream + session state
│   └── use-ai-sessions.ts         # React Query CRUD for sessions/messages (Step 12)
│
├── services/
│   └── ai-chat.service.ts         # fetch + ReadableStream for /api/ai/chat/stream
│
├── store/
│   └── ai.atoms.ts                # Jotai atoms for AI sidebar state
│
└── types/
    └── ai-chat.types.ts           # AiMessage, AiSession, RagSource interfaces
```

---

### `types/ai-chat.types.ts`

```typescript
// Note: AiAction is already defined in ee/ai/types/ai.types.ts
// These are the NEW types for the persistent chat sidebar

export interface RagSource {
  pageId: string;
  title: string;
  slugId: string;
  spaceSlug: string;
  excerpt: string;
  similarity: number;
  chunkIndex: number;
}

export interface AiMessage {
  id: string;
  // sessionId is optional at the client side until Step 12 persists sessions.
  // Do not treat '' as a valid FK value — it is a local-only placeholder.
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  sources: RagSource[];   // stored in JSONB, loaded with message
  createdAt: string;
}

export interface AiSession {
  id: string;
  workspaceId: string;
  pageId: string | null;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiStreamEvent {
  type: 'sources' | 'chunk' | 'error';
  data: RagSource[] | string;
}
```

---

### `store/ai.atoms.ts`

```typescript
import { atom } from 'jotai';
import { AiMessage, AiSession, RagSource } from '../types/ai-chat.types';

// Active session
export const aiActiveSessionAtom = atom<AiSession | null>(null);

// Messages for the active session (loaded from DB + live streaming)
export const aiMessagesAtom = atom<AiMessage[]>([]);

// Sources returned by the LAST RAG call — used to resolve [^n] citations.
// Reset at the start of each new user message.
export const aiSourcesAtom = atom<RagSource[]>([]);

// Streaming state
export const aiIsStreamingAtom = atom<boolean>(false);

// Accumulates text chunks during streaming — cleared on each new message
export const aiStreamingContentAtom = atom<string>('');

// Sessions list for the sidebar header/history view (populated in Step 12)
export const aiSessionsAtom = atom<AiSession[]>([]);
```

---

### `services/ai-chat.service.ts`

```typescript
import { AiStreamEvent, RagSource } from '../types/ai-chat.types';

interface StreamCallbacks {
  onSources: (sources: RagSource[]) => void;
  onChunk: (chunk: string) => void;
  onError: (error: string) => void;
  onComplete: () => void;
}

/**
 * Consumes the /api/ai/chat/stream SSE endpoint.
 * Parses two event types:
 *   { type: 'sources', data: RagSource[] }  — emitted before the answer starts
 *   { type: 'chunk',   data: string }        — text delta
 *   { type: 'error',   data: string }        — error message
 *
 * Returns an AbortController — call .abort() to cancel the stream.
 */
export async function streamAiChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  callbacks: StreamCallbacks,
): Promise<AbortController> {
  const abortController = new AbortController();

  try {
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: abortController.signal,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    const processStream = async () => {
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6);
            if (raw === '[DONE]') { callbacks.onComplete(); return; }

            try {
              const event: AiStreamEvent = JSON.parse(raw);
              if (event.type === 'sources') {
                callbacks.onSources(event.data as RagSource[]);
              } else if (event.type === 'chunk') {
                callbacks.onChunk(event.data as string);
              } else if (event.type === 'error') {
                callbacks.onError(event.data as string);
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') callbacks.onError(err.message);
      } finally {
        reader?.releaseLock();
      }
    };

    processStream(); // fire-and-forget
  } catch (err: any) {
    callbacks.onError(err.message);
  }

  return abortController;
}
```

---

### `hooks/use-ai-chat.ts`

```typescript
import { useCallback, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  aiMessagesAtom,
  aiSourcesAtom,
  aiIsStreamingAtom,
  aiStreamingContentAtom,
} from '../store/ai.atoms';
import { streamAiChat } from '../services/ai-chat.service';
import { AiMessage, RagSource } from '../types/ai-chat.types';

export function useAiChat() {
  const [messages, setMessages] = useAtom(aiMessagesAtom);
  const setSources = useSetAtom(aiSourcesAtom);
  const setIsStreaming = useSetAtom(aiIsStreamingAtom);
  const setStreamingContent = useSetAtom(aiStreamingContentAtom);
  // Use a ref for messages inside the callback to avoid stale closure issues.
  // The ref always holds the latest messages without requiring it in useCallback deps.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Append user message to local state immediately
    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      sources: [],
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setSources([]);
    setStreamingContent('');
    setIsStreaming(true);

    // Build messages array for the API (last 10 messages for context window).
    // Read from ref so we get the pre-update messages, then append the new one.
    const history = [...messagesRef.current, userMessage]
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    let collectedSources: RagSource[] = [];
    let collectedContent = '';

    abortRef.current = await streamAiChat(history, {
      onSources: (sources) => {
        collectedSources = sources;
        setSources(sources);
      },
      onChunk: (chunk) => {
        collectedContent += chunk;
        setStreamingContent(prev => prev + chunk);
      },
      onError: (error) => {
        console.error('AI chat error:', error);
        setIsStreaming(false);
      },
      onComplete: () => {
        // Replace streaming state with a persisted-looking message.
        // sessionId is intentionally absent here — it will be set in Step 12
        // once the server persists the session and returns the real ID.
        const assistantMessage: AiMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: collectedContent,
          sources: collectedSources,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setStreamingContent('');
        setIsStreaming(false);
      },
    });
  // Stable deps: setters from useAtom/useSetAtom are stable references.
  // messagesRef avoids putting messages in the dep array (stale closure risk).
  }, [setMessages, setSources, setIsStreaming, setStreamingContent]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, [setIsStreaming]);

  return { sendMessage, stopStream };
}
```

---

### `components/AiCitationRenderer.tsx`

> **Security note:** `rehype-raw` is required so that the pre-processed `<cite data-ref="n">`
> tags survive the markdown pipeline. However, `rehype-raw` alone allows ANY HTML from the LLM
> output to render as real DOM — including `<script>`, `<img onerror=...>` etc. — which is an
> XSS vector when the content source is an LLM.
>
> **Mitigation:** Add `rehype-sanitize` with a strict allowlist that permits only `<cite>` and
> standard safe markdown elements. The sanitize plugin must run AFTER `rehype-raw` in the plugin
> chain. Requires: `pnpm --filter client add rehype-sanitize`.

```typescript
import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Popover, Text, Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import { RagSource } from '../types/ai-chat.types';
import { buildPageUrl } from '@/features/page/page.utils';

interface AiCitationRendererProps {
  content: string;
  sources: RagSource[];
}

/**
 * Renders AI-generated markdown with inline citation popovers.
 *
 * The LLM is prompted to cite sources using [^n] notation.
 * This component:
 *   1. Pre-processes [^n] → <cite data-ref="n">n</cite>
 *   2. rehype-raw allows <cite> through the pipeline
 *   3. rehype-sanitize strips all other HTML (XSS prevention)
 *   4. The custom 'cite' component renders as a Mantine Popover
 */

// Extend the default sanitize schema to allow only <cite data-ref>
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'cite'],
  attributes: {
    ...defaultSchema.attributes,
    cite: ['dataRef'],
  },
};

const preprocessCitations = (text: string): string =>
  text.replace(/\[\^(\d+)\]/g, '<cite data-ref="$1">$1</cite>');

export function AiCitationRenderer({ content, sources }: AiCitationRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema],  // must come AFTER rehype-raw
      ]}
      components={{
        // @ts-expect-error — 'cite' is a valid HTML element, typings are incomplete
        cite: ({ node, children }) => {
          const ref = Number(node?.properties?.dataRef);
          const source = sources[ref - 1];

          if (!source) {
            return <sup>[{ref}]</sup>;
          }

          return (
            <Popover withArrow width={280} position="top" shadow="md">
              <Popover.Target>
                <sup
                  style={{
                    cursor: 'pointer',
                    color: 'var(--mantine-color-blue-6)',
                    fontWeight: 600,
                  }}
                >
                  [{ref}]
                </sup>
              </Popover.Target>
              <Popover.Dropdown>
                <Text fw={600} size="sm" mb={4}>
                  {source.title}
                </Text>
                {source.excerpt && (
                  <Text c="dimmed" size="xs" mb={8} lineClamp={3}>
                    {source.excerpt}
                  </Text>
                )}
                <Anchor
                  component={Link}
                  to={buildPageUrl(source.spaceSlug, source.slugId, source.title)}
                  size="xs"
                >
                  Open page →
                </Anchor>
              </Popover.Dropdown>
            </Popover>
          );
        },
      }}
    >
      {preprocessCitations(content)}
    </ReactMarkdown>
  );
}
```

---

### `components/AiMessageList.tsx`

```typescript
import { Stack, Text, Box, Loader } from '@mantine/core';
import { useAtomValue } from 'jotai';
import { aiMessagesAtom, aiIsStreamingAtom, aiStreamingContentAtom, aiSourcesAtom } from '../store/ai.atoms';
import { AiCitationRenderer } from './AiCitationRenderer';

export function AiMessageList() {
  const messages = useAtomValue(aiMessagesAtom);
  const isStreaming = useAtomValue(aiIsStreamingAtom);
  const streamingContent = useAtomValue(aiStreamingContentAtom);
  const sources = useAtomValue(aiSourcesAtom);

  return (
    <Stack gap="md" p="md" style={{ flex: 1, overflowY: 'auto' }}>
      {messages.map((msg) => (
        <Box key={msg.id}>
          {msg.role === 'user' ? (
            <Box
              p="sm"
              bg="var(--mantine-color-blue-0)"
              style={{ borderRadius: 8, alignSelf: 'flex-end' }}
            >
              <Text size="sm">{msg.content}</Text>
            </Box>
          ) : (
            // Persisted assistant message — uses its own stored sources for citations
            <AiCitationRenderer content={msg.content} sources={msg.sources} />
          )}
        </Box>
      ))}

      {/* Live streaming message — uses current sources atom */}
      {isStreaming && streamingContent && (
        <Box>
          <AiCitationRenderer content={streamingContent} sources={sources} />
          <Loader size="xs" mt={4} />
        </Box>
      )}

      {isStreaming && !streamingContent && (
        <Box>
          <Loader size="xs" />
          <Text size="xs" c="dimmed" ml={8}>Searching knowledge base...</Text>
        </Box>
      )}
    </Stack>
  );
}
```

---

### `components/AiMessageInput.tsx`

```typescript
import { useState, useCallback } from 'react';
import { Group, Textarea, ActionIcon } from '@mantine/core';
import { IconArrowUp, IconPlayerStop } from '@tabler/icons-react';
import { useAtomValue } from 'jotai';
import { aiIsStreamingAtom } from '../store/ai.atoms';
import { useAiChat } from '../hooks/use-ai-chat';

export function AiMessageInput() {
  const [input, setInput] = useState('');
  const isStreaming = useAtomValue(aiIsStreamingAtom);
  const { sendMessage, stopStream } = useAiChat();

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <Group p="sm" align="flex-end" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
      <Textarea
        style={{ flex: 1 }}
        placeholder="Ask about your workspace..."
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        autosize
        minRows={1}
        maxRows={5}
        disabled={isStreaming}
      />
      <ActionIcon
        variant="filled"
        color={isStreaming ? 'red' : 'blue'}
        radius="xl"
        onClick={isStreaming ? stopStream : handleSubmit}
        disabled={!isStreaming && !input.trim()}
      >
        {isStreaming
          ? <IconPlayerStop size={16} />
          : <IconArrowUp size={16} />
        }
      </ActionIcon>
    </Group>
  );
}
```

---

### `components/AiSidebar.tsx`

```typescript
import { Stack, Group, Text, ActionIcon, Button, ScrollArea } from '@mantine/core';
import { IconSparkles, IconX, IconHistory } from '@tabler/icons-react';
import { useAtom, useSetAtom } from 'jotai';
import { asideStateAtom } from '@/components/layouts/global/hooks/atoms/sidebar-atom';
import { AiMessageList } from './AiMessageList';
import { AiMessageInput } from './AiMessageInput';
import { aiMessagesAtom, aiSourcesAtom, aiStreamingContentAtom } from '../store/ai.atoms';

/**
 * Persistent right-sidebar AI chat panel.
 * Integrates into the existing asideStateAtom pattern — same as comments/TOC tabs.
 *
 * To open: setAsideState({ tab: 'ai', isAsideOpen: true })
 * To close: setAsideState({ tab: '', isAsideOpen: false })
 *
 * Note: asideStateAtom has type { tab: string; isAsideOpen: boolean }.
 * There is no toggleAside helper — set the atom directly.
 */
export function AiSidebar() {
  const [, setAsideState] = useAtom(asideStateAtom);
  const setMessages = useSetAtom(aiMessagesAtom);
  const setSources = useSetAtom(aiSourcesAtom);
  const setStreamingContent = useSetAtom(aiStreamingContentAtom);

  const handleClose = () => setAsideState({ tab: '', isAsideOpen: false });

  const handleNewChat = () => {
    setMessages([]);
    setSources([]);
    setStreamingContent('');
    // TODO Step 12: create new session via useAiSessions hook
  };

  return (
    <Stack gap={0} h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Group
        p="sm"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
      >
        <Group gap="xs">
          <IconSparkles size={18} color="var(--mantine-color-blue-6)" />
          <Text fw={600} size="sm">AI Assistant</Text>
        </Group>
        <Group gap={4}>
          <ActionIcon variant="subtle" size="sm" onClick={handleNewChat} title="New chat">
            <IconHistory size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" size="sm" onClick={handleClose}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Message list — grows to fill available space */}
      <ScrollArea style={{ flex: 1 }}>
        <AiMessageList />
      </ScrollArea>

      {/* Input — pinned to bottom */}
      <AiMessageInput />
    </Stack>
  );
}
```

---

### Integration: Add AI Tab to Page Header

**File to update:** `apps/client/src/features/page/components/header/page-header.tsx`

Add an AI button alongside the existing comments/TOC toggle buttons:
```typescript
// Add import
import { IconSparkles } from '@tabler/icons-react';
import { useSetAtom } from 'jotai';
import { asideStateAtom } from '@/components/layouts/global/hooks/atoms/sidebar-atom';

// Inside the component:
const setAsideState = useSetAtom(asideStateAtom);

// Add button alongside existing comment/toc buttons.
// Use setAsideState directly — there is no toggleAside helper function.
<Tooltip label="AI Assistant">
  <ActionIcon
    variant="subtle"
    onClick={() => setAsideState({ tab: 'ai', isAsideOpen: true })}
  >
    <IconSparkles size={18} />
  </ActionIcon>
</Tooltip>
```

**File to update:** The aside panel renderer (wherever `'comments'` and `'toc'` tabs are rendered):
```typescript
import { AiSidebar } from '@/features/ai/components/AiSidebar';

{asideState.tab === 'ai' && <AiSidebar />}
```

> **Frontend AI gating:** There is no `window.CONFIG` mechanism in Docmost.
> Gate the AI button using a simple React Query call to `GET /api/ai/status`:
> ```typescript
> const { data } = useQuery({
>   queryKey: ['ai-status'],
>   queryFn: () => api.get('/ai/status').then(r => r.data),
>   staleTime: Infinity,  // config doesn't change at runtime
> });
> // Only render the AI button if data?.configured === true
> {data?.configured && (
>   <Tooltip label="AI Assistant">
>     <ActionIcon ... />
>   </Tooltip>
> )}
> ```

---

### Migrate Existing EE AI Components

The existing `apps/client/src/ee/ai/` files should be migrated to `apps/client/src/features/ai/`:

| From | To | Notes |
|---|---|---|
| `ee/ai/types/ai.types.ts` | `features/ai/types/ai.types.ts` | Move as-is, update import paths |
| `ee/ai/services/ai-service.ts` | `features/ai/services/ai-service.ts` | Move as-is |
| `ee/ai/services/ai-search-service.ts` | `features/ai/services/ai-search-service.ts` | Move as-is |
| `ee/ai/hooks/use-ai.ts` | `features/ai/hooks/use-ai.ts` | Move as-is |
| `ee/ai/hooks/use-ai-search.ts` | `features/ai/hooks/use-ai-search.ts` | Move as-is |
| `ee/ai/queries/ai-query.ts` | `features/ai/queries/ai-query.ts` | Move as-is |
| `ee/ai/components/editor/ai-menu/` | `features/ai/components/editor/ai-menu/` | Move entire folder |
| `ee/ai/components/ai-search-result.tsx` | `features/ai/components/AiSearchResult.tsx` | Upgrade to use `AiCitationRenderer` |
| `ee/ai/components/enable-*.tsx` | `features/ai/components/` | Move as-is |
| `ee/ai/pages/ai-settings.tsx` | `features/ai/pages/ai-settings.tsx` | Move as-is; **also update router registration** |

Update the import in `page-editor.tsx`:
```typescript
// Before:
import { EditorAiMenu } from "@/ee/ai/components/editor/ai-menu/ai-menu";
// After:
import { EditorAiMenu } from "@/features/ai/components/editor/ai-menu/ai-menu";
```

> **Router registration:** When moving `ai-settings.tsx`, also find and update the React Router
> route definition that references the old `ee/ai/pages/ai-settings` path. Search for
> `ai-settings` in the router config files to locate it.

---

## Build Sequence (Strict Order — Each Step Independently Testable)

### Step 0 — Docker + pgvector (if using Docker)
```bash
# Edit docker-compose.yml: change postgres image from postgres:18 to pgvector/pgvector:pg18
# Then rebuild:
docker compose down
docker compose up -d --build

# Verify pgvector is available:
docker compose exec db psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
```
For non-Docker local installs: install pgvector for your Postgres version, then:
```bash
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Step 1 — Migrations + type codegen
```bash
# Create migration files (use current timestamp):
pnpm nx run server:migration:create page_embeddings
pnpm nx run server:migration:create ai_sessions
pnpm nx run server:migration:create ai_messages

# Fill in migration content per specs above, then run:
pnpm nx run server:migration:latest

# Regenerate Kysely types:
pnpm nx run server:migration:codegen

# Verify db.interface.ts still has pageEmbeddings (codegen doesn't add it):
grep -n 'pageEmbeddings' apps/server/src/database/types/db.interface.ts
```

### Step 2 — `page-embedding.repo.ts`
- Single DB access point for the `page_embeddings` table
- Test: write a unit test that inserts a dummy embedding and queries it back

### Step 3 — `ai-provider.interface.ts` + `openai.provider.ts`
- Only OpenAI/ZhipuAI provider for now
- Add to `.env`: `AI_DRIVER=openai-compatible`, `OPENAI_API_KEY`, `OPENAI_API_URL`, `AI_COMPLETION_MODEL=glm-4-flash`, `AI_EMBEDDING_MODEL=embedding-3`, `AI_EMBEDDING_DIMENSION=1024`
- Test: write a small script that calls `generateEmbeddings(['test'])` and prints the vector length

### Step 4 — `embedding.service.ts` + `ai-queue.processor.ts`
- Wire the existing BullMQ AI_QUEUE jobs to the `EmbeddingService`
- Test: create a page in the UI, verify a job appears in BullMQ and `page_embeddings` rows are inserted

### Step 5 — `rag.service.ts`
- Implement `retrieve()` with the pgvector cosine similarity query
- Test: query a question against the embedded pages, verify ranked results come back
- Verify with a direct DB query: `SELECT 1 - (embedding <=> '[...]'::vector) as similarity FROM page_embeddings ORDER BY similarity DESC LIMIT 5`

### Step 6 — `ai-orchestrator.service.ts` + `ai.controller.ts` + `ai.module.ts` (SSE endpoints)
- Wire everything together
- **Register `AiModule` in `app.module.ts`**
- Install server dependency: `pnpm --filter server add openai`
- Test with curl before touching the frontend:
  ```bash
  # Test AI status:
  curl http://localhost:3000/api/ai/status

  # Test editor generation:
  curl -X POST http://localhost:3000/api/ai/generate/stream \
    -H "Content-Type: application/json" \
    -b "authToken=YOUR_JWT" \
    -d '{"action":"summarize","content":"This is a test page about quarterly planning..."}' \
    --no-buffer

  # Test RAG chat:
  curl -X POST http://localhost:3000/api/ai/chat/stream \
    -H "Content-Type: application/json" \
    -b "authToken=YOUR_JWT" \
    -d '{"messages":[{"role":"user","content":"What is our Q3 plan?"}]}' \
    --no-buffer
  ```

### Step 7 — `AiCitationRenderer.tsx` + updated `AiSearchResult`
- Install client dependencies: `pnpm --filter client add rehype-raw rehype-sanitize react-markdown remark-gfm`
- New frontend component with rehype-sanitize XSS protection
- Upgrade `AiSearchResult` to use `AiCitationRenderer` instead of `dangerouslySetInnerHTML`
- Test: render with mock sources + content containing `[^1]`

### Step 8 — `ai.atoms.ts` + `ai-chat.service.ts` + `use-ai-chat.ts`
- New Jotai atoms + streaming service + hook
- Test: open browser DevTools Network tab, verify SSE chunks arrive and atoms update

### Step 9 — `AiSidebar.tsx` + `AiMessageList.tsx` + `AiMessageInput.tsx`
- Full chat UI using Mantine components
- Consistent with existing sidebar styling (match spacing, colors, font sizes of `CommentsSidebar`)

### Step 10 — Wire sidebar toggle into page header + aside renderer + AI status gating
- **File:** `apps/client/src/features/page/components/header/page-header.tsx` (confirmed filename)
- Add AI sparkles button — gated by `GET /api/ai/status` response
- Add `{asideState.tab === 'ai' && <AiSidebar />}` to the aside panel renderer
- Use `setAsideState({ tab: 'ai', isAsideOpen: true })` directly (no `toggleAside` helper)

### Step 11 — Migrate `ee/ai/` → `features/ai/`
- Move all existing EE AI components
- Update all import paths (including router registration for `ai-settings` page)
- Verify editor AI menu still works end-to-end

### Step 12 — Session persistence
- Implement `ai-session.repo.ts` and `ai-message.repo.ts` using Kysely + generated types
- Add `AiSessionRepo`, `AiMessageRepo` to `AiModule.providers`
- Add session creation at the start of `streamChat` handler (before emitting sources)
- Add message persistence after stream completes
- Implement `use-ai-sessions.ts` React Query hook
- Add session CRUD endpoints to `AiController` (inject repos in constructor)
- Add `AiSessionDto`, `AiMessageResponseDto` per dto spec above
- Update `use-ai-chat.ts` to set `sessionId` on messages once the server returns it
- Add session history list to `AiSidebar`

---

## Dependencies to Install

### Server
```bash
# OpenAI SDK (for all OpenAI-compatible providers including ZhipuAI, Ollama)
pnpm --filter server add openai

# Vercel AI SDK (for Gemini provider — optional, install only if using Gemini)
pnpm --filter server add ai @ai-sdk/google
```

### Client
```bash
# All four packages are required for AiCitationRenderer.
# react-markdown and remark-gfm are NOT already installed in apps/client.
pnpm --filter client add react-markdown remark-gfm rehype-raw rehype-sanitize
```

---

## Key Architectural Decisions Recorded

| Decision | Rationale |
|---|---|
| `apps/server/src/ai/` not `ee/ai/` | `ee/` is being phased out per product direction |
| `apps/client/src/features/ai/` not `ee/ai/` | Consistent, non-EE location; existing `ee/ai/` files to be migrated |
| ZhipuAI via `openai-compatible` driver | Single `OpenAiProvider` class handles all OpenAI-compatible endpoints; no new provider class needed for ZhipuAI specifically |
| `embedding-3` at 1024 dimensions | ZhipuAI supports this dimension; fits in existing `AI_EMBEDDING_DIMENSION` validator values |
| `vector(1024)` in migration | Matches `AI_EMBEDDING_DIMENSION=1024`; if switching providers write a migration to ALTER COLUMN + TRUNCATE |
| PostgreSQL + pgvector (not Qdrant/Milvus) | No new infrastructure; uses existing Postgres instance; `isPageEmbeddingsTableExists()` guard already in codebase |
| `pgvector/pgvector:pg18` Docker image | Stock `postgres:18` has no pgvector; must use the official pgvector-enabled build |
| SSE over WebSocket for AI streaming | Simpler; one-directional AI → client stream; WebSocket reserved for Yjs collab |
| `reply.hijack()` on all SSE endpoints | Required by Fastify to prevent double-response errors; confirmed by Docmost v0.24.1 hotfix |
| `BullModule.registerQueue` in `AiModule` | Processor's DI context needs the queue registered in the same module |
| Session CRUD deferred to Step 12 | Avoids bootstrap DI failures from injecting non-existent repos in Steps 1–11 |
| `sources` as JSONB in `ai_messages` | Self-contained history — no joins needed to render citations from old messages |
| Workspace-scoped RAG | All pages in the workspace are searchable; no space filtering in Phase 1 |
| `asideStateAtom` for sidebar toggle | Reuses existing aside state machine; `tab` is plain `string`, set directly |
| Native `fetch` + `ReadableStream` (not EventSource) | Matches pattern already used in `ee/ai/services/ai-service.ts` |
| `rehype-sanitize` after `rehype-raw` | Prevents XSS from LLM-injected HTML while still allowing `<cite>` elements |
| `messagesRef` in `useAiChat` | Avoids stale closure on messages without adding it to `useCallback` dep array |
| `GET /api/ai/status` for frontend gating | No `window.CONFIG` exists in Docmost; React Query status check is the correct pattern |
| `AiSessionDto` defined in Step 6 | Was listed in file map without implementation; now fully specified above |

---

## Open Items / Future Phases

- [ ] **Token limit management:** Truncate message history to fit within the LLM's context window; use tiktoken in Phase 2
- [ ] **Space-scoped filtering:** Add optional `spaceId` parameter to `RagService.retrieve()` for focused searches
- [ ] **Attachment embeddings:** `PageEmbeddings.attachmentId` field is already in the schema — embed PDF/text attachments in Phase 2
- [ ] **Workflow engine (DAG):** Multi-step AI operations — use BullMQ Flow Producers (already supported)
- [ ] **Agentic tool calls:** LLM function calling to read/create/update pages via OpenAI tool_calls API
- [ ] **Quota enforcement:** Redis rolling window counter per workspace — add before production deployment
- [ ] **Gemini embedding support:** Implement using `@google/generative-ai` SDK directly
- [ ] **HNSW index tuning:** Increase `ef_construction` and `m` for better recall at scale
- [ ] **Page-scoped sessions:** Add `page_id` filtering option when user wants context limited to current page
- [ ] **Provider switch migration script:** Document ALTER COLUMN + TRUNCATE steps for changing embedding dimensions
