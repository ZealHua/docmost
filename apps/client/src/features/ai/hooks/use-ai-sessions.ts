import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client.ts';
import { AiSession } from '../types/ai-chat.types';

export function useAiSessions(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ['ai-sessions', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const response = await api.get<AiSession[]>(`/ai/sessions`);
      return response.data;
    },
    enabled: !!workspaceId,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (pageId?: string) => {
      const response = await api.post<AiSession>(`/ai/sessions`, { pageId });
      return response.data;
    },
    onSuccess: (newSession) => {
      queryClient.setQueryData<AiSession[]>(['ai-sessions', workspaceId], (old = []) => [
        newSession,
        ...old,
      ]);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/ai/sessions/${sessionId}`);
    },
    onSuccess: (_, sessionId) => {
      queryClient.setQueryData<AiSession[]>(['ai-sessions', workspaceId], (old = []) =>
        old.filter((s) => s.id !== sessionId),
      );
    },
  });

  const renameSessionMutation = useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string }) => {
      const response = await api.patch<AiSession>(`/ai/sessions/${sessionId}`, { title });
      return response.data;
    },
    onSuccess: (updatedSession) => {
      queryClient.setQueryData<AiSession[]>(['ai-sessions', workspaceId], (old = []) =>
        old.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      );
    },
  });

  const loadSessionMessages = useCallback(
    async (sessionId: string) => {
      const response = await api.get<{
        session: AiSession;
        messages: Array<{
          id: string;
          sessionId: string;
          role: 'user' | 'assistant';
          content: string;
          sources: any[];
          createdAt: string;
        }>;
      }>(`/ai/sessions/${sessionId}`);
      return response.data;
    },
    [],
  );

  return {
    sessions: sessionsQuery.data ?? [],
    isLoading: sessionsQuery.isLoading,
    error: sessionsQuery.error,
    refetch: sessionsQuery.refetch,
    createSession: (pageId?: string) => createSessionMutation.mutateAsync(pageId),
    deleteSession: (sessionId: string) => deleteSessionMutation.mutateAsync(sessionId),
    renameSession: ({ sessionId, title }: { sessionId: string; title: string }) =>
      renameSessionMutation.mutateAsync({ sessionId, title }),
    loadSessionMessages,
  };
}
