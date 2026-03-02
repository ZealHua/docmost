# Docmost Intelligence Feature — Architecture & Key Implementation Map

## Purpose

This document records the core technologies, architecture, and realization details of the Intelligence feature in Docmost. It maps key files and their positions for easy reference by agents and developers.

---

## 1. Architecture Overview

The Intelligence feature consists of three layers and two main processing paths:

- **Frontend (React + Mantine + Jotai)**
- **Docmost NestJS Server (TypeScript)**

### Processing Paths

- **Regular AI Chat (designMode=false)**

---

## 2. Technology Stack

| Layer              | Technology            | Role                                |
| ------------------ | --------------------- | ----------------------------------- |
| Frontend Framework | React 18 + Mantine UI | Components, styling                 |
| State Management   | Jotai atoms           | Global state (aiMessagesAtom, etc.) |
| Routing            | React Router          | /ai page                            |
| Backend Framework  | NestJS + Fastify      | REST API + SSE streaming            |
| AI Providers       | OpenAI-compatible SDK | GLM-4.7-flash, DeepSeek, MiniMax-M2 |
| RAG                | pgvector (PostgreSQL) | Cosine similarity search            |
| Web Search         | Serper API proxy      | External search                     |
| Memory             | Mem0                  | Long-term conversational memory     |
| Agent Gateway      | LangGraph (Python)    | Agentic workflow with tool use      |
| Sandbox            | Local file system     | Executes bash, writes files         |
| SSE Protocol       | Server-Sent Events    | Real-time streaming                 |

---

## 3. Key Files Map

### Frontend (apps/client)

| Feature           | File Path                                                 | Description                          |
| ----------------- | --------------------------------------------------------- | ------------------------------------ |
| Main AI Page      | apps/client/src/features/ai/pages/AiPage.tsx              | Page layout, session logic           |
| Message Input     | apps/client/src/features/ai/components/AiMessageInput.tsx | Input bar, toggles, model select     |
| Message List      | apps/client/src/features/ai/components/AiMessageList.tsx  | Renders messages, streaming content  |
| Chat Hook         | apps/client/src/features/ai/hooks/use-ai-chat.ts          | Regular chat hook, calls NestJS SSE  |
| Design Chat Hook  | apps/client/src/features/ai/hooks/use-design-chat.ts      | Web Design hook, calls LangGraph SSE |
| LangGraph Stream  | apps/client/src/features/ai/hooks/use-langgraph-stream.ts | Raw SSE streaming to LangGraph       |
| Chat Service      | apps/client/src/features/ai/services/ai-chat.service.ts   | SSE consumer for NestJS              |
| Atoms             | apps/client/src/features/ai/store/ai.atoms.ts             | Jotai atoms for state                |
| Model Config      | apps/client/src/features/ai/lib/models.config.ts          | Frontend model registry              |
| Artifacts Context | apps/client/src/features/ai/context/artifacts-context.tsx | Artifact panel state                 |

### Backend (apps/server/src/ai)

| Feature            | File Path                                              | Description                        |
| ------------------ | ------------------------------------------------------ | ---------------------------------- |
| Controller         | apps/server/src/ai/ai.controller.ts                    | REST endpoints for AI feature      |
| Orchestrator       | apps/server/src/ai/services/ai-orchestrator.service.ts | Provider routing logic             |
| Provider Interface | apps/server/src/ai/interfaces/ai-provider.interface.ts | Provider contract                  |
| OpenAI Provider    | apps/server/src/ai/providers/openai.provider.ts        | OpenAI-compatible provider         |
| RAG Service        | apps/server/src/ai/services/rag.service.ts             | pgvector similarity search         |
| Web Search Service | apps/server/src/ai/services/web-search.service.ts      | Query rewriting, Serper API search |
| Model Config       | apps/server/src/ai/models.config.ts                    | Server-side model mapping          |
| Module             | apps/server/src/ai/ai.module.ts                        | NestJS module wiring               |

---

## 4. Realization Flow

### Path 1: Regular AI Chat (designMode=false)

- Session creation, message streaming, context retrieval, RAG, web search, SSE chunking, memory persistence.
- Key files: AiMessageInput.tsx, use-ai-chat.ts, ai-chat.service.ts, ai.controller.ts, ai-orchestrator.service.ts, rag.service.ts, web-search.service.ts.
