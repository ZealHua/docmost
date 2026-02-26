import { useQuery } from '@tanstack/react-query';
import { urlOfArtifact } from '../lib/artifact-utils';

async function loadArtifactContent({
  filepath,
  sessionId,
}: {
  filepath: string;
  sessionId: string;
}): Promise<string> {
  const url = urlOfArtifact({ filepath, sessionId });
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch artifact: ${response.statusText}`);
  }

  return response.text();
}

export function useArtifactContent({
  filepath,
  sessionId,
  enabled = true,
}: {
  filepath: string;
  sessionId: string;
  enabled?: boolean;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['artifact-content', sessionId, filepath],
    queryFn: () => loadArtifactContent({ filepath, sessionId }),
    enabled: enabled && !!filepath && !!sessionId,
    // Cache artifact content for 5 minutes to avoid repeated fetches
    staleTime: 5 * 60 * 1000,
  });

  return { content: data ?? '', isLoading, error };
}
