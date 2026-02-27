/**
 * Message Grouping Engine
 *
 * Transforms a flat list of AiMessages into structured MessageGroups
 * for richer UI rendering of LangGraph agentic workflows.
 */
import { AiMessage } from "../types/ai-chat.types";

// ── MessageGroup discriminated union ────────────────────────────

export interface HumanMessageGroup {
  type: "human";
  id: string;
  messages: AiMessage[];
}

export interface AssistantMessageGroup {
  type: "assistant:message";
  id: string;
  messages: AiMessage[];
}

export interface AssistantProcessingGroup {
  type: "assistant:processing";
  id: string;
  /** The AI message that initiated tool calls */
  triggerMessage: AiMessage;
  /** Tool response messages */
  toolResponses: AiMessage[];
  /** The final AI response after tool execution (if available) */
  resultMessage?: AiMessage;
}

export interface AssistantPresentFilesGroup {
  type: "assistant:present-files";
  id: string;
  messages: AiMessage[];
  files: string[];
}

export interface AssistantClarificationGroup {
  type: "assistant:clarification";
  id: string;
  messages: AiMessage[];
}

export interface AssistantSubagentGroup {
  type: "assistant:subagent";
  id: string;
  messages: AiMessage[];
  tasks: Array<{
    id: string;
    subagent_type: string;
    description: string;
    prompt: string;
    status: "in_progress" | "completed" | "error";
  }>;
}

export type MessageGroup =
  | HumanMessageGroup
  | AssistantMessageGroup
  | AssistantProcessingGroup
  | AssistantPresentFilesGroup
  | AssistantClarificationGroup
  | AssistantSubagentGroup;

// ── Grouping logic ──────────────────────────────────────────────

/**
 * Groups a flat message list into structured MessageGroups.
 *
 * Rules:
 * - Consecutive user messages → HumanMessageGroup
 * - Assistant message with tool_calls → start AssistantProcessingGroup
 * - Tool result messages → attach to current ProcessingGroup
 * - Messages from 'ask_clarification' tool → AssistantClarificationGroup
 * - Messages referencing artifacts → AssistantPresentFilesGroup
 * - Regular assistant text → AssistantMessageGroup
 */
export function groupMessages(messages: AiMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];

    // ── Human messages ──
    if (msg.role === "user") {
      const humanMsgs: AiMessage[] = [];
      while (i < messages.length && messages[i].role === "user") {
        humanMsgs.push(messages[i]);
        i++;
      }
      groups.push({
        type: "human",
        id: `human-${humanMsgs[0].id}`,
        messages: humanMsgs,
      });
      continue;
    }

    // ── Clarification messages ──
    if (msg.id.startsWith("clarification-")) {
      groups.push({
        type: "assistant:clarification",
        id: `clarification-${msg.id}`,
        messages: [msg],
      });
      i++;
      continue;
    }

    // ── AI message with tool calls → Processing group ──
    if (
      msg.messageType === "tool_use" &&
      msg.tool_calls &&
      msg.tool_calls.length > 0
    ) {
      const toolResponses: AiMessage[] = [];
      const triggerMessage = msg;
      i++;

      // Collect subsequent tool response messages
      while (i < messages.length && messages[i].messageType === "tool_result") {
        toolResponses.push(messages[i]);
        i++;
      }

      // Check if next message is the final assistant response
      let resultMessage: AiMessage | undefined;
      if (
        i < messages.length &&
        messages[i].role === "assistant" &&
        messages[i].messageType !== "tool_use" &&
        messages[i].messageType !== "tool_result"
      ) {
        // Check if any tool was 'present_file' → PresentFilesGroup instead
        const presentFileTools = toolResponses.filter(
          (r) => r.tool_name === "present_file",
        );
        if (presentFileTools.length > 0) {
          const files = presentFileTools.map((r) => r.content).filter(Boolean);

          groups.push({
            type: "assistant:present-files",
            id: `present-files-${triggerMessage.id}`,
            messages: [triggerMessage, ...toolResponses, messages[i]],
            files,
          });
          i++;
          continue;
        }

        resultMessage = messages[i];
        i++;
      }

      groups.push({
        type: "assistant:processing",
        id: `processing-${triggerMessage.id}`,
        triggerMessage,
        toolResponses,
        resultMessage,
      });
      continue;
    }

    // ── Regular assistant message ──
    const assistantMsgs: AiMessage[] = [];
    while (
      i < messages.length &&
      messages[i].role === "assistant" &&
      !messages[i].id.startsWith("clarification-") &&
      messages[i].messageType !== "tool_use" &&
      messages[i].messageType !== "tool_result"
    ) {
      assistantMsgs.push(messages[i]);
      i++;
    }

    if (assistantMsgs.length > 0) {
      groups.push({
        type: "assistant:message",
        id: `message-${assistantMsgs[0].id}`,
        messages: assistantMsgs,
      });
    }
  }

  return groups;
}
