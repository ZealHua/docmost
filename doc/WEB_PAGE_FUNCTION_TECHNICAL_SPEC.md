# Web Page Function - Technical Specification

**Document Version**: 1.0
**Last Updated**: 2026-03-01
**Scope**: Backend endpoints, data formats, and frontend integration for web search, web fetch, and image search capabilities

---

## Overview

Docmost provides two distinct approaches for web page functionality:

1. **NestJS AI Service Layer** (`/apps/server/src/ai/`) - Direct API endpoints for RAG chat with web search integration
2. **LangGraph Agent Gateway** (`/apps/agent-gateway/`) - Agent-based tools for autonomous web interaction

This document covers both approaches with detailed endpoint specifications, data formats, and integration patterns.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │ useAiChat    │      │ useDesignChat│      │ Other UI  │ │
│  └──────┬───────┘      └──────┬───────┘      └──────┬────┘ │
│         │                     │                     │      │
└─────────┼─────────────────────┼─────────────────────┼──────┘
          │                     │                     │
          │   ┌─────────────────┼─────────────────┐   │
          │   │                 │                 │   │
          ▼   ▼                 ▼                 ▼   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Layer                            │
│  ┌──────────────────┐          ┌───────────────────────┐    │
│  │ NestJS AI Module │          │ Agent Gateway         │    │
│  │ (Port 3000)      │          │ (Port 2024/8001)      │    │
│  │                  │          │                       │    │
│  │ • /ai/chat/stream│          │ • LangGraph SSE       │    │
│  │ • /ai/generate   │          │ • Gateway API         │    │
│  │ • Web Search     │          │ • Web Tools           │    │
│  └────────┬─────────┘          └──────────┬────────────┘    │
│           │                               │                 │
└───────────┼───────────────────────────────┼─────────────────┘
            │                               │
            ▼                               ▼
┌────────────────────────┐      ┌──────────────────────────┐
│  Web Search Service    │      │  LangGraph Tools         │
│  (Serper API)          │      │  • web_search (Tavily)   │
│                        │      │  • web_fetch (Jina AI)   │
│  Query Rewrite →       │      │  • image_search (DDG)    │
│  Search → Results      │      │                          │
└────────────────────────┘      └──────────────────────────┘
```

---

## Approach 1: NestJS AI Service Layer

### Endpoint: Streaming RAG Chat with Web Search

**URL**: `POST /api/ai/chat/stream`

**Description**: Main chat endpoint that supports Retrieval-Augmented Generation with optional web search. Used by `useAiChat` hook in the editor and chat interface.

**Authentication**: JWT Auth Required

**Request Body** (`AiChatDto`):

```typescript
interface AiChatDto {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  sessionId?: string;           // Optional session ID for persistence
  model: string;                // Model name (e.g., 'glm-4.5', 'deepseek-reasoner')
  thinking?: boolean;           // Enable thinking mode for supported models
  isWebSearchEnabled?: boolean; // Enable web search integration
  selectedPageIds?: string[];   // Optional: specific pages to search
  skipUserPersist?: boolean;    // Skip persisting user message (for regeneration)
}
```

**Example Request**:

```json
{
  "messages": [
    {"role": "user", "content": "What are the latest developments in AI for 2025?"}
  ],
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "model": "glm-4.5",
  "thinking": false,
  "isWebSearchEnabled": true,
  "selectedPageIds": []
}
```

**Response**: Server-Sent Events (SSE) Stream

**Event Types**:

1. **Sources Event** - Sent first when web search finds results

```
event: message
data: {"type":"sources","data":[{"pageId":"web","title":"AI Developments 2025","url":"https://example.com/ai-2025","excerpt":"Latest AI breakthroughs...","similarity":1.0,"spaceSlug":"","slugId":"","chunkIndex":0}]}
```

2. **Chunk Event** - Streaming response content

```
event: message
data: {"type":"chunk","data":"Based on the latest research..."}
```

3. **Thinking Event** - Thinking/reasoning content (for thinking models)

```
event: message
data: {"type":"thinking","data":"Let me analyze the search results..."}
```

4. **Memory Event** - Memory system status

```
event: message
data: {"type":"memory","data":{"enabled":true,"loaded":true}}
```

5. **Error Event** - Error handling

```
event: message
data: {"type":"error","data":"Web search failed: API error"}
```

6. **Done Event** - Stream completion

```
event: message
data: [DONE]
```

**Web Search Flow**:

```
1. User sends message with isWebSearchEnabled: true
2. Backend calls WebSearchService.rewriteQuery(messages)
   - LLM analyzes if search is needed
   - Returns search query or "NO_SEARCH"
3. If search needed: WebSearchService.search(query)
   - Calls Serper API
   - Returns formatted results
4. Results injected as "web" sources in RAG context
5. LLM generates answer with citations [^1], [^2], etc.
6. Sources persisted with assistant message
```

**Data Flow**:

```typescript
// Frontend: useAiChat hook
sendMessage("What is the weather today?") →
  streamAiChat(history, callbacks, { isWebSearchEnabled: true }) →
    POST /api/ai/chat/stream →
      WebSearchService.rewriteQuery() →
        LLM: "Should I search?" → "weather today" →
      WebSearchService.search("weather today") →
        Serper API → results[] →
      SSE: {type: 'sources', data: results} →
      SSE: {type: 'chunk', data: "According to current weather data..."} →
      Frontend: onSources() → render citations
      Frontend: onChunk() → append to message
```

---

## Approach 2: LangGraph Agent Gateway

### Overview

The Agent Gateway provides autonomous web interaction through LangGraph tools. The agent decides when to use web tools based on user queries.

**Base URL**: `http://localhost:2024` (LangGraph) or `http://localhost:8001` (Gateway API)

**Frontend Client**: `apps/client/src/lib/langgraph-client.ts`

### Endpoint: LangGraph Streaming

**URL**: `POST /api/langgraph/threads/{thread_id}/runs/stream`

**Description**: Main LangGraph streaming endpoint for agent-based conversations. Used by `useLangGraphStream` and `useDesignChat` hooks.

**Request Body**:

```typescript
interface LangGraphStreamRequest {
  assistant_id: string;        // "lead_agent"
  stream_mode: string[];       // ["values", "messages-tuple", "custom"]
  input?: {
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
  };
  command?: {
    resume: { answer: string }; // For clarification responses
  };
  config: {
    recursion_limit: number;
    configurable: {
      model_name: string;
      thinking_enabled: boolean;
      is_plan_mode: boolean;
      subagent_enabled: boolean;
      thread_id: string;
    };
  };
}
```

**Example Request**:

```json
{
  "assistant_id": "lead_agent",
  "stream_mode": ["values", "messages-tuple", "custom"],
  "input": {
    "messages": [{"role": "user", "content": "Search for the latest AI news"}]
  },
  "config": {
    "recursion_limit": 1000,
    "configurable": {
      "model_name": "doubao-seed-2-0-mini-260215",
      "thinking_enabled": true,
      "is_plan_mode": true,
      "subagent_enabled": false,
      "thread_id": "thread_123"
    }
  }
}
```

**Response**: Server-Sent Events with multiple stream modes

**Event Types**:

| Event Type | stream_mode | Implementation Status | How Handled |
|------------|-------------|----------------------|-------------|
| `values` | ✅ Subscribed | ✅ Complete | Extracts `artifacts`, `title`, `todos`, `messages`, `uploaded_files`, `viewed_images`. Overwrites `messageAccumulator` for complete snapshots. |
| `messages-tuple` | ✅ Subscribed | ✅ Complete | Parses `[id, payload]` tuples. Appends delta to `messageAccumulator` for streaming content. |
| `messages` | Backward compat | ✅ Complete | Appends delta to `messageAccumulator`. Legacy support for older stream format. |
| `custom` | ✅ Subscribed | ✅ Complete | Dispatches `SubtaskEvent` → `aiSubtaskProgressAtom` → `SubtaskProgress` UI component. |
| `end` | — | ✅ Complete | Recognized in event parser, signals stream completion. |

**Event Details**:

1. **Values Event** - Full state snapshot

```
event: values
data: {
  "messages": [...],
  "artifacts": ["file1.html", "file2.css"],
  "title": "AI News Research",
  "todos": [{"id": "1", "task": "Search web", "completed": true}],
  "uploaded_files": [...],      // Files uploaded by agent
  "viewed_images": [...]        // Images viewed by agent
}
```

**Frontend Processing**:
- Extracts thread state for UI updates
- Syncs title to session (if changed)
- Updates todos list
- Handles artifact file paths
- **Pending**: `uploaded_files` and `viewed_images` extraction (next stage)

2. **Messages-Tuple Event** - Streaming message deltas

```
event: messages-tuple
data: ["message_id", {
  "type": "ai",
  "content": "Let me search",
  "tool_calls": [{"name": "web_search", "args": {"query": "AI news 2025"}}]
}]
```

**Frontend Processing**:
- Parses tuple format: `[message_id, payload]`
- Appends content delta to accumulator
- Extracts tool calls for rendering
- Handles reasoning content for thinking models
- Updates last message ID for tracking

3. **Custom Event** - Subtask progress

```
event: custom
data: {
  "type": "task_running",
  "task_id": "search_task",
  "message": "Searching the web..."
}
```

**Frontend Processing**:
- Dispatches to `aiSubtaskProgressAtom`
- Updates `SubtaskProgress` UI component
- Real-time progress tracking for multi-step tasks

### Web Tools Available to Agent

#### 1. Web Search Tool (Tavily)

**Tool Name**: `web_search`

**Location**: `src/community/tavily/tools.py`

**Function Signature**:

```python
def web_search_tool(query: str) -> str:
    """Search the web.

    Args:
        query: The query to search for.
    """
```

**Returns**: JSON string with search results

```json
[
  {
    "title": "AI Breakthrough 2025",
    "url": "https://example.com/ai-2025",
    "snippet": "Latest developments in artificial intelligence..."
  }
]
```

**Configuration** (in `config.yaml`):

```yaml
tools:
  - name: web_search
    group: web
    use: src.community.tavily.tools:web_search_tool
    max_results: 5
    api_key: $TAVILY_API_KEY  # Optional override
```

**When Agent Uses It**:
- User asks about current events, news, or recent developments
- Query requires factual information beyond training data
- Agent determines search would improve answer quality

**Example Interaction**:

```
User: "What happened in AI this week?"
Agent: (calls web_search with query "AI news this week")
Tool: Returns 5 search results
Agent: Analyzes results and provides summary with citations
```

---

#### 2. Web Fetch Tool (Jina AI)

**Tool Name**: `web_fetch`

**Location**: `src/community/jina_ai/tools.py`

**Function Signature**:

```python
def web_fetch_tool(url: str) -> str:
    """Fetch the contents of a web page at a given URL.

    Args:
        url: The URL to fetch the contents of.
    """
```

**Returns**: Markdown-formatted content (first 4096 chars)

```markdown
# Article Title

Article content in markdown format...
```

**Configuration** (in `config.yaml`):

```yaml
tools:
  - name: web_fetch
    group: web
    use: src.community.jina_ai.tools:web_fetch_tool
    timeout: 10
```

**When Agent Uses It**:
- After web_search returns URLs, agent may fetch full content
- User provides specific URL to analyze
- Need detailed information from a single page

**Example Interaction**:

```
User: "Summarize this article: https://example.com/ai-article"
Agent: (calls web_fetch with url)
Tool: Returns full article markdown
Agent: Provides summary of key points
```

---

#### 3. Image Search Tool (DuckDuckGo)

**Tool Name**: `image_search`

**Location**: `src/community/image_search/tools.py`

**Function Signature**:

```python
def image_search_tool(
    query: str,
    max_results: int = 5,
    size: str | None = None,
    type_image: str | None = None,
    layout: str | None = None
) -> str:
    """Search for images online.

    Args:
        query: Search keywords
        max_results: Maximum number of images (default: 5)
        size: "Small", "Medium", "Large", "Wallpaper"
        type_image: "photo", "clipart", "gif", "transparent", "line"
        layout: "Square", "Tall", "Wide"
    """
```

**Returns**: JSON string with image results

```json
{
  "query": "Japanese woman street photography 1990s",
  "total_results": 5,
  "results": [
    {
      "title": "Street photo from 1990s Japan",
      "image_url": "https://...",
      "thumbnail_url": "https://..."
    }
  ],
  "usage_hint": "Use the 'image_url' values as reference images..."
}
```

**Configuration** (in `config.yaml`):

```yaml
tools:
  - name: image_search
    group: web
    use: src.community.image_search.tools:image_search_tool
    max_results: 5
```

**When Agent Uses It**:
- Before image generation to find reference images
- User asks for visual references or examples
- Agent needs visual context for better responses

**Example Interaction**:

```
User: "Generate an image of a Japanese woman in 1990s street fashion"
Agent: (calls image_search with query "Japanese woman street photography 1990s fashion")
Tool: Returns 5 reference images
Agent: Downloads references, then calls image generation tool
Agent: "I've generated an image based on 1990s Japanese street fashion references..."
```

---

## Data Formats Reference

### Web Search Result Format

**Source**: Both Tavily (NestJS) and web_search tool (LangGraph)

```typescript
interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;  // or content
}

// NestJS format (for RAG)
interface RagSource {
  pageId: string;        // 'web' for web search
  title: string;
  url: string;
  excerpt: string;
  similarity: number;    // 1.0 for web results
  spaceSlug: string;     // '' for web
  slugId: string;        // '' for web
  chunkIndex: number;
}
```

### Message Format

**Frontend Internal** (`AiMessage`):

```typescript
interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  sources?: RagSource[];
  createdAt: string;
  sessionId?: string;
}
```

**LangGraph Messages**:

```typescript
interface LangGraphMessage {
  type: 'human' | 'ai' | 'tool';
  content: string | Array<{type: string, text?: string}>;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
    id: string;
  }>;
  id?: string;
}
```

### Tool Call Format

```typescript
interface ToolCall {
  name: string;           // "web_search", "web_fetch", "image_search"
  args: {
    query?: string;       // for web_search, image_search
    url?: string;         // for web_fetch
    max_results?: number;
    size?: string;
    type_image?: string;
    layout?: string;
  };
  id: string;             // Unique call ID
}
```

---

## Frontend Architecture & UI Components

### Message Grouping System

**Location**: `apps/client/src/features/ai/lib/message-grouping.ts`

The frontend groups related messages for rich UI rendering of agent workflows:

**MessageGroup Types** (6 total):

```typescript
type MessageGroup =
  | { type: 'user'; message: AiMessage }                          // Single user message
  | { type: 'assistant'; message: AiMessage }                     // Single assistant message
  | { type: 'tool'; toolCallId: string; messages: AiMessage[] }   // Tool call + result pair
  | { type: 'clarification'; message: AiMessage }                 // Clarification request
  | { type: 'error'; message: AiMessage }                         // Error message
  | { type: 'group'; messages: AiMessage[] }                      // Generic grouped messages
```

**Grouping Logic**:
- Groups tool calls with their results
- Combines consecutive assistant messages
- Separates clarifications and errors
- Enables collapsible tool call displays

**Usage**:

```typescript
import { groupMessages } from '@/features/ai/lib/message-grouping';

const groups = groupMessages(messages);
// Render groups with different UI for each type
```

---

### UI Components for Web Tools

#### 1. ToolCallBlock Component

**Location**: `apps/client/src/features/ai/components/ToolCallBlock.tsx`

**Purpose**: Displays tool calls and their results in a collapsible format

**Features**:
- Shows tool name and arguments
- Collapsible execution details
- Displays tool results (search results, fetched content, images)
- Dark theme styling

**Props**:

```typescript
interface ToolCallBlockProps {
  toolCall: ToolCall;
  result?: string;        // Tool execution result
  isExpanded?: boolean;
  onToggle?: () => void;
}
```

**Example**:

```tsx
<ToolCallBlock
  toolCall={{
    name: 'web_search',
    args: { query: 'AI news 2025' },
    id: 'call_123'
  }}
  result='[{"title": "AI Breakthrough", "url": "..."}]'
/>
```

---

#### 2. SubtaskProgress Component

**Location**: `apps/client/src/features/ai/components/SubtaskProgress.tsx`

**Purpose**: Real-time progress tracking for agent subtasks

**Features**:
- Shows active subtask status
- Progress indicators for multi-step workflows
- Updates via `custom` SSE events
- Dark theme styling

**Data Flow**:

```
LangGraph custom event →
aiSubtaskProgressAtom →
SubtaskProgress component →
Real-time UI updates
```

**Example**:

```tsx
<SubtaskProgress
  events={[
    {
      type: 'task_running',
      task_id: 'web_search',
      message: 'Searching for AI news...'
    }
  ]}
/>
```

---

#### 3. AiMessageList Component

**Location**: `apps/client/src/features/ai/components/AiMessageList.tsx`

**Purpose**: Group-aware message rendering with tool call support

**Features**:
- Renders grouped messages (6 group types)
- Integrates ToolCallBlock for tool messages
- Handles clarification and error displays
- Manages artifact file chips

**Integration**:

```tsx
<AiMessageList
  groups={groupMessages(messages)}
  showArtifacts={true}
/>
```

---

### State Management (Jotai Atoms)

**Location**: `apps/client/src/features/ai/store/ai.atoms.ts`

**Key Atoms for Web Tools**:

```typescript
// Subtask progress for agent workflows
export const aiSubtaskProgressAtom = atom<SubtaskEvent[]>([]);

// Todo list from agent thread state
export const aiTodosAtom = atom<Todo[]>([]);

// Messages with tool calls and sources
export const aiMessagesAtom = atom<AiMessage[]>([]);

// Streaming content accumulation
export const aiStreamingContentAtom = atom<string>('');

// Web search enabled state
export const aiWebSearchEnabledAtom = atom<boolean>(false);
```

**Usage in Components**:

```typescript
import { useAtom } from 'jotai';
import { aiSubtaskProgressAtom } from '../store/ai.atoms';

function MyComponent() {
  const [subtaskProgress] = useAtom(aiSubtaskProgressAtom);
  
  return <SubtaskProgress events={subtaskProgress} />;
}
```

---

## Frontend Integration Guide

### Option 1: Using NestJS AI Chat (Recommended for Simple Web Search)

**When to Use**:
- Simple chat interface with optional web search toggle
- Need citations and sources in responses
- Want to leverage existing RAG infrastructure
- Don't need autonomous agent decision-making

**Implementation**:

```typescript
// In your chat component
import { useAiChat } from '@/features/ai/hooks/use-ai-chat';

function ChatComponent() {
  const { sendMessage, isStreaming } = useAiChat(workspaceId);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const handleSend = async (content: string) => {
    await sendMessage(content);
  };

  // Toggle web search
  const toggleWebSearch = () => {
    setWebSearchEnabled(!webSearchEnabled);
    // Update atom that useAiChat reads
    setAiWebSearchEnabled(!webSearchEnabled);
  };

  return (
    <>
      <MessageList />
      <MessageInput 
        onSend={handleSend}
        disabled={isStreaming}
      />
      <button onClick={toggleWebSearch}>
        {webSearchEnabled ? '🔍 Web Search On' : 'Web Search Off'}
      </button>
    </>
  );
}
```

**Key Files**:
- `apps/client/src/features/ai/hooks/use-ai-chat.ts`
- `apps/client/src/features/ai/services/ai-chat.service.ts`
- `apps/server/src/ai/ai.controller.ts` (streamChat method)
- `apps/server/src/ai/services/web-search.service.ts`

**Configuration**:

```typescript
// Environment variables
SERPER_API_KEY=your_serper_key
SERPER_DEBUG=true  // Optional: enable debug logging
AI_DEBUG=true      // Optional: enable AI debug logs
```

---

### Option 2: Using LangGraph Agent (Recommended for Autonomous Tasks)

**When to Use**:
- Complex multi-step workflows
- Need agent to autonomously decide when to search
- Building design/code generation features
- Want to leverage subagents and tool chaining
- Need sandboxed code execution alongside web tools

**Implementation**:

```typescript
// In your agent-based component
import { useDesignChat } from '@/features/ai/hooks/use-design-chat';
import { ensureThreadId } from '@/features/ai/hooks/use-langgraph-stream';

function AgentComponent() {
  const { sendDesignMessage, isStreaming } = useDesignChat();
  const [threadId, setThreadId] = useState<string | null>(null);

  // Initialize thread
  useEffect(() => {
    const init = async () => {
      const id = await ensureThreadId();
      setThreadId(id);
    };
    init();
  }, []);

  const handleSend = async (content: string) => {
    await sendDesignMessage(content);
  };

  return (
    <>
      <AgentMessageList />
      <AgentInput 
        onSend={handleSend}
        disabled={isStreaming}
      />
      {/* Agent automatically uses web tools when needed */}
    </>
  );
}
```

**Key Files**:
- `apps/client/src/features/ai/hooks/use-design-chat.ts`
- `apps/client/src/features/ai/hooks/use-langgraph-stream.ts`
- `apps/client/src/lib/langgraph-client.ts`
- `apps/agent-gateway/src/agents/lead_agent/` (agent logic)
- `apps/agent-gateway/src/community/` (web tools)

**Configuration**:

```yaml
# config.yaml for agent-gateway
models:
  - name: doubao-seed-2-0-mini-260215
    display_name: Doubao 2.0 Mini
    use: langchain_deepseek:ChatDeepSeek
    model: doubao-seed-2-0-mini-260215
    api_base: https://ark.cn-beijing.volces.com/api/v3
    api_key: $YOUR_API_KEY
    supports_thinking: true
    supports_vision: true

tools:
  - name: web_search
    group: web
    use: src.community.tavily.tools:web_search_tool
    max_results: 5
    api_key: $TAVILY_API_KEY

  - name: web_fetch
    group: web
    use: src.community.jina_ai.tools:web_fetch_tool
    timeout: 10

  - name: image_search
    group: web
    use: src.community.image_search.tools:image_search_tool
    max_results: 5
```

---

### Option 3: Direct API Calls (Custom Integration)

**When to Use**:
- Building custom UI outside React hooks
- Need fine-grained control over request/response
- Integrating with external systems

**Direct NestJS API Call**:

```typescript
import api from '@/lib/api-client';

const streamChat = async (messages, options) => {
  const response = await api.post('/ai/chat/stream', {
    messages,
    sessionId: options.sessionId,
    model: options.model,
    isWebSearchEnabled: options.webSearch,
    selectedPageIds: options.pageIds,
  }, {
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      const data = progressEvent.currentTarget.response;
      const lines = data.split('\n\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '[DONE]') return;
          
          const event = JSON.parse(payload);
          
          switch (event.type) {
            case 'sources':
              renderSources(event.data);
              break;
            case 'chunk':
              appendContent(event.data);
              break;
            case 'thinking':
              showThinking(event.data);
              break;
            case 'error':
              showError(event.data);
              break;
          }
        }
      }
    }
  });
};
```

**Direct LangGraph API Call**:

```typescript
import { getLangGraphClient } from '@/lib/langgraph-client';

const streamFromAgent = async (content, threadId) => {
  const client = getLangGraphClient();
  
  const stream = await client.runs.stream(threadId, 'lead_agent', {
    input: {
      messages: [{ role: 'user', content }]
    },
    config: {
      configurable: {
        model_name: 'doubao-seed-2-0-mini-260215',
        thinking_enabled: true,
      }
    },
    streamMode: ['values', 'messages-tuple', 'custom']
  });
  
  for await (const event of stream) {
    const [eventType, data] = event;
    
    switch (eventType) {
      case 'values':
        updateState(data);
        break;
      case 'messages-tuple':
        appendMessage(data);
        break;
      case 'custom':
        updateProgress(data);
        break;
    }
  }
};
```

---

## Implementation Status & Pending Items

### Review Scorecard

| # | Item | Status | Details |
|---|------|--------|---------|
| 1 | SSE stream_mode configuration | ✅ Complete | `messages-tuple` + `custom` events subscribed |
| 2 | Custom events → subtask progress | ✅ Complete | `SubtaskProgress` UI component active |
| 3 | End event handling | ✅ Complete | Stream completion recognized |
| 4 | LangGraphState extraction | ⚠️ Partial | `artifacts`, `title`, `todos` extracted; `uploaded_files`, `viewed_images` pending |
| 5 | Message type model | ✅ Complete | `tool_calls`, `tool_result` supported |
| 6 | Message grouping | ✅ Complete | 6 MessageGroup types implemented |
| 7 | Title sync to session | ✅ Complete | Auto-title generation working |
| 8 | Delta-safe accumulation | ✅ Complete | `messageAccumulator` prevents overwrites |
| 9 | Backend message IDs | ✅ Complete | `lastMessageId` tracking for edits/regeneration |
| 10 | Tool call UI | ✅ Complete | `ToolCallBlock` component renders tool calls |
| 11 | Clarification handling | ✅ Complete | Clarification requests and responses working |
| 12 | Error parsing | ✅ Complete | Error details extracted and displayed |

**10 of 12 core items complete. 2 pending for next stage.**

---

### Pending Items (Next Stage)

| Priority | Item | Description | Impact |
|----------|------|-------------|--------|
| 🟡 Medium | `uploaded_files` extraction | Agent-uploaded files not extracted from `values` events | Users can't see files agent created/uploaded |
| 🟡 Medium | `viewed_images` extraction | Agent-viewed images not extracted from `values` events | Users can't see images agent referenced |
| 🟢 Low | `is_plan_mode` toggle | Hardcoded to `true`, no UI to switch modes | Users can't disable plan mode |
| 🟢 Low | End-to-end testing | Not tested against live LangGraph backend | Needs validation before production |

**Recommendation**: Implement `uploaded_files` and `viewed_images` extraction next, as these directly impact web tool user experience.

---

### Testing Checklist

Before deploying web tool functionality:

- [ ] Web search returns results and displays in `ToolCallBlock`
- [ ] Web fetch shows fetched content in tool results
- [ ] Image search displays images in UI
- [ ] Subtask progress updates in real-time
- [ ] Tool calls are collapsible/expandable
- [ ] Sources from web search are rendered as citations
- [ ] Error states (API failures, timeouts) handled gracefully
- [ ] Message grouping correctly pairs tool calls with results
- [ ] Uploaded files from agent appear in UI
- [ ] Viewed images from agent appear in UI

---

## Error Handling

### NestJS AI Chat Errors

```typescript
// Error event format
event: message
data: {"type":"error","data":"Web search failed: API timeout"}

// HTTP errors
- 503: AI not configured
- 404: Session not found
- 401: Unauthorized
- 500: Internal server error
```

### LangGraph Errors

```typescript
// Stream error handling
onError: (error) => {
  if (error.name === 'AbortError') {
    // User cancelled
  } else {
    // Show error message
    showError(error.message);
  }
}

// Common errors
- "Thread not found": Invalid thread_id
- "Model not available": Model configuration issue
- "Tool execution failed": Web tool error
- "Rate limit exceeded": API quota exceeded
```

### Web Tool Specific Errors

**Web Search**:
- `API key not configured`: Tavily API key missing
- `Rate limit exceeded`: Too many requests
- `Network error`: Connection failed
- `No results found`: Empty search results

**Web Fetch**:
- `Invalid URL`: Malformed URL
- `Cannot fetch content`: Page blocked or requires auth
- `Timeout`: Request took too long
- `Content too large`: Exceeded size limits

**Image Search**:
- `ddgs library not installed`: Missing dependency
- `No images found`: Empty results
- `Network error`: Connection to DDG failed

---

## Performance Considerations

### NestJS AI Chat

- **Web Search Latency**: ~1-2 seconds for query rewrite + search
- **Streaming**: Real-time token streaming after search completes
- **Timeouts**: 30s default for complete response
- **Rate Limits**: Depends on Serper API plan

### LangGraph Agent

- **Tool Decision**: Agent decides to use tools (adds ~1-3 seconds)
- **Multiple Tools**: Can chain tools (search → fetch → analyze)
- **Subagents**: Parallel execution possible (max 3 concurrent)
- **Timeouts**: 15 minutes per subagent, configurable
- **Rate Limits**: Per-tool API limits apply

### Optimization Tips

1. **Cache Search Results**: For repeated queries
2. **Debounce User Input**: Wait for user to stop typing
3. **Show Loading States**: Indicate search in progress
4. **Handle Timeouts Gracefully**: Show partial results if available
5. **Batch Requests**: Group related tool calls
6. **Monitor Costs**: Track API usage per tool

---

## Testing

### Testing Web Search in NestJS

```bash
# Start server
cd apps/server
pnpm run start:dev

# Test endpoint
curl -X POST http://localhost:3000/api/ai/chat/stream \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "isWebSearchEnabled": true,
    "model": "glm-4.5"
  }'
```

### Testing LangGraph Tools

```bash
# Start agent gateway
cd apps/agent-gateway
make dev  # LangGraph on port 2024

# Create thread and test
curl -X POST http://localhost:2024/threads \
  -H "Content-Type: application/json" \
  | jq '.thread_id'

# Stream to thread
curl -N http://localhost:2024/threads/{thread_id}/runs/stream \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "lead_agent",
    "input": {"messages": [{"role": "user", "content": "Search for AI news"}]},
    "config": {"configurable": {"model_name": "doubao-seed-2-0-mini-260215"}},
    "stream_mode": ["messages-tuple"]
  }'
```

---

## Security Considerations

### URL Validation

- **Web Fetch**: Only fetches exact URLs from search results or user input
- **URL Format**: Must include schema (`https://example.com`, not `example.com`)
- **No Auth Pages**: Cannot access content behind login walls
- **Rate Limiting**: Per-user rate limits to prevent abuse

### Content Sanitization

- **HTML Stripping**: Web content converted to markdown
- **Script Removal**: No executable code in fetched content
- **Size Limits**: Max 4096 chars for web fetch results
- **Timeout Protection**: 10-second default timeout

### API Key Management

- **Environment Variables**: Never commit API keys to repo
- **Server-Side Only**: Keys never exposed to frontend
- **Rotation**: Support for key rotation without restart
- **Fallback**: Graceful degradation if keys missing

---

## Future Enhancements

### Planned Features

1. **Advanced Web Search**
   - Custom search engines
   - Domain-specific search
   - Search result ranking improvements

2. **Enhanced Web Fetch**
   - JavaScript rendering support
   - PDF extraction
   - Multi-page crawling

3. **Image Search Improvements**
   - More image providers
   - Better filtering options
   - Image metadata extraction

4. **Tool Combinations**
   - Automatic search + fetch pipeline
   - Image search → generation workflow
   - Web research → report generation

5. **Monitoring & Analytics**
   - Tool usage analytics
   - Performance metrics
   - Cost tracking per tool

---

## References

### Backend Files

- **NestJS AI Controller**: `apps/server/src/ai/ai.controller.ts`
- **Web Search Service**: `apps/server/src/ai/services/web-search.service.ts`
- **LangGraph Lead Agent**: `apps/agent-gateway/src/agents/lead_agent/`
- **Web Tools**: `apps/agent-gateway/src/community/`

### Frontend Files

- **AI Chat Hook**: `apps/client/src/features/ai/hooks/use-ai-chat.ts`
- **Design Chat Hook**: `apps/client/src/features/ai/hooks/use-design-chat.ts`
- **LangGraph Stream**: `apps/client/src/features/ai/hooks/use-langgraph-stream.ts`
- **LangGraph Client**: `apps/client/src/lib/langgraph-client.ts`

### Configuration

- **Agent Config**: `apps/agent-gateway/config.yaml`
- **Environment**: `.env` (API keys)

### Documentation

- **Agent Gateway**: `apps/agent-gateway/AGENTS.md`
- **API Docs**: `apps/agent-gateway/docs/API.md`
- **Architecture**: `apps/agent-gateway/docs/ARCHITECTURE.md`

---

## Summary Decision Tree

```
Need web functionality?
│
├─> Simple chat with optional search?
│   └─> Use NestJS AI Chat (/api/ai/chat/stream)
│       • Toggle web search on/off
│       • Get citations in response
│       • Leverage existing RAG
│
├─> Complex agent workflows?
│   └─> Use LangGraph Agent (/api/langgraph)
│       • Agent autonomously uses tools
│       • Multi-step reasoning
│       • Sandbox + web tools combined
│
└─> Direct API access?
    └─> Use direct fetch calls
        • Full control over requests
        • Custom UI integration
        • External system integration
```

---

**End of Technical Specification**
