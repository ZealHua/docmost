import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api-client";

export interface DeepResearchAuditStats {
  assistantMessagesWithApprovalAudit: number;
  sessions: {
    awaitingApproval: number;
    approved: number;
    completed: number;
    cancelled: number;
  };
}

export function useDeepResearchAuditStats(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["deep-research-audit-stats", workspaceId],
    queryFn: async () => {
      const response = await api.get<DeepResearchAuditStats>("/ai/deep-research/audit/stats");
      return response.data;
    },
    enabled: !!workspaceId && import.meta.env.DEV,
    staleTime: 60_000,
  });
}
