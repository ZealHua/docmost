Memo: Semantic Search (RAG.retrieve) - To Be Revisited

Location

apps/server/src/ai/ai.controller.ts - lines ~432-437

Current State

Semantic search (ragService.retrieve()) is commented out with a note explaining it returns top 5 pages which is not the expected behavior.

Why It Was Disabled

The current Intelligence feature design only wants explicitly selected pages to be used as RAG context. Semantic search was automatically returning top 5 similar pages when no pages were selected, which was unexpected behavior.
