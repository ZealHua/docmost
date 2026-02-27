import { Client } from "@langchain/langgraph-sdk";

let _singleton: Client | null = null;

const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_LANGGRAPH_BASE_URL;

  if (envUrl) {
    return envUrl;
  }
  // Fallback for client-side
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/langgraph`;
  }
  return "";
};

const LANGGRAPH_BASE_URL = getBaseUrl();

export { LANGGRAPH_BASE_URL };

export function getLangGraphClient(): Client {
  _singleton ??= new Client({
    apiUrl: LANGGRAPH_BASE_URL,
  });
  return _singleton;
}

export async function createThread(): Promise<{ thread_id: string }> {
  const client = getLangGraphClient();
  return await client.threads.create({});
}

export async function getThread(threadId: string) {
  const client = getLangGraphClient();
  return await client.threads.get(threadId);
}

export type { Client };
